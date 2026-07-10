// ── Piezômetro — Cloudflare Worker ───────────────────────────────────────────
// Port do server.js (Node.js puro / Render) para Cloudflare Workers.
// Mesma responsabilidade: ingestão das leituras do ESP32 (/ingest), leitura
// dessas leituras para o dashboard (/ultimos, /dados) e motor de alertas
// Telegram/SMS — só que aqui o motor de alertas roda como CRON TRIGGER
// (scheduled()) em vez de setInterval(), o estado de notificação é
// persistido no KV (Workers não mantêm estado entre invocações), e as
// leituras ficam no Cloudflare D1 (SQLite) em vez de um InfluxDB externo.
//
// Nota sobre rate limiting: o server.js original limitava requisições por IP
// em memória (rateBuckets). Isso não é possível de forma confiável em Workers
// (cada isolate pode processar requisições sem estado compartilhado local, e
// múltiplos data centers não veem o mesmo mapa). Omitimos essa proteção aqui
// de propósito — se for necessária, use o Cloudflare Rate Limiting nativo
// (regra na dashboard/WAF) em vez de reimplementar em memória.

const PIEZOMETRO_ID_RE = /^[A-Za-z0-9_-]{1,32}$/;
const INGEST_MAX_BYTES = 64 * 1024; // /ingest recebe lotes do store & forward
const INGEST_MAX_LEITURAS = 200;

// Janelas de agregação disponíveis em GET /dados: nome → { janela em
// segundos, tamanho do bucket em segundos usado no GROUP BY }.
const RANGES = {
  "24h": { janela: 24 * 3600, bucket: 1800 },
  "7d": { janela: 7 * 24 * 3600, bucket: 7200 },
  "30d": { janela: 30 * 24 * 3600, bucket: 28800 },
};

// ── HELPERS DE CONFIG ─────────────────────────────────────────────────────────
function getConfig(env) {
  const ALLOWED_ORIGIN = env.ALLOWED_ORIGIN || "*";
  const DEVICE_KEY = env.DEVICE_KEY || "";

  const NIVEL_ATENCAO = parseFloat(env.NIVEL_ATENCAO || "12");
  const NIVEL_CRITICO = parseFloat(env.NIVEL_CRITICO || "15");
  const ALERT_REPEAT_MIN = parseInt(env.ALERT_REPEAT_MIN || "15", 10);

  // P2 (alarme de comunicação) e P3 (taxa de variação) — ver
  // docs/DASHBOARD_PROFISSIONAL.md §2/§4/§6.
  const SILENCE_ALERT_SEC = parseInt(env.SILENCE_ALERT_SEC || "900", 10);
  const TAXA_JANELA_MIN = parseInt(env.TAXA_JANELA_MIN || "60", 10);
  const TAXA_MAX_M_DIA = parseFloat(env.TAXA_MAX_M_DIA || "0.5");
  const STALE_SEG = parseInt(env.STALE_SEG || "60", 10);

  // P4 — histerese (deadband) na classificação de nível: evita alarme
  // "chattering" quando o nível oscila bem em cima do limiar (ISA-18.2).
  // Só é aplicada na DESCIDA de faixa — ver classifyComHisterese().
  const HISTERESE_M = parseFloat(env.HISTERESE_M || "0.2");

  const TELEGRAM_BOT_TOKEN = env.TELEGRAM_BOT_TOKEN || "";
  const TELEGRAM_CHAT_ID = env.TELEGRAM_CHAT_ID || "";
  const TWILIO_ACCOUNT_SID = env.TWILIO_ACCOUNT_SID || "";
  const TWILIO_AUTH_TOKEN = env.TWILIO_AUTH_TOKEN || "";
  const TWILIO_FROM = env.TWILIO_FROM || "";
  const TWILIO_TO = env.TWILIO_TO || "";

  const telegramOn = !!(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID);
  const smsOn = !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM && TWILIO_TO);

  return {
    ALLOWED_ORIGIN, DEVICE_KEY,
    NIVEL_ATENCAO, NIVEL_CRITICO, ALERT_REPEAT_MIN,
    SILENCE_ALERT_SEC, TAXA_JANELA_MIN, TAXA_MAX_M_DIA, STALE_SEG, HISTERESE_M,
    TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
    TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM, TWILIO_TO,
    telegramOn, smsOn,
  };
}

// Timeout de 15s para chamadas HTTP externas (Telegram/Twilio), igual ao
// httpsRequest() do server.js (req.setTimeout(15000, ...)).
function timeoutSignal() {
  return AbortSignal.timeout(15000);
}

// ── HELPERS DE RESPOSTA ───────────────────────────────────────────────────────
function corsHeaders(cfg, extra) {
  return {
    "Access-Control-Allow-Origin": cfg.ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    ...extra,
  };
}

function json(cfg, status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: corsHeaders(cfg, { "Content-Type": "application/json; charset=utf-8" }),
  });
}

// Lê o corpo da requisição como texto, respeitando um limite de bytes — tanto
// via Content-Length (checagem antecipada) quanto pelo tamanho real lido
// (Content-Length pode ser omitido ou mentiroso).
async function readBodyLimited(request, maxBytes) {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > maxBytes) {
    return { tooLarge: true };
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) {
    return { tooLarge: true };
  }
  return { text };
}

// ── INGESTÃO (placa → D1) ────────────────────────────────────────────────────
// Normaliza uma leitura bruta {piezometro?, nivel_agua, pressao?, temperatura?,
// ts?} em um objeto pronto para virar bind params do INSERT. Retorna null se
// nivel_agua não for um número finito (campo obrigatório).
function normalizarLeitura(leitura) {
  if (!leitura || typeof leitura !== "object") return null;

  const nivel = leitura.nivel_agua;
  if (typeof nivel !== "number" || !Number.isFinite(nivel)) return null;

  const pressao =
    typeof leitura.pressao === "number" && Number.isFinite(leitura.pressao) ? leitura.pressao : null;
  const temperatura =
    typeof leitura.temperatura === "number" && Number.isFinite(leitura.temperatura)
      ? leitura.temperatura
      : null;

  const piezometro =
    typeof leitura.piezometro === "string" && PIEZOMETRO_ID_RE.test(leitura.piezometro)
      ? leitura.piezometro
      : "PZ-01";

  const tsBruto = leitura.ts;
  const ts =
    Number.isInteger(tsBruto) && tsBruto > 1e9 && tsBruto < 1e11
      ? tsBruto
      : Math.floor(Date.now() / 1000);

  return { piezometro, nivel_agua: nivel, pressao, temperatura, ts };
}

// ── MOTOR DE ALERTAS ───────────────────────────────────────────────────────────
// Classificação "pura" (sem histerese): usada tanto na SUBIDA de faixa quanto
// no primeiro ciclo de um piezômetro (quando ainda não há faixa anterior).
function classify(cfg, n) {
  if (n >= cfg.NIVEL_CRITICO) return "CRITICO";
  if (n >= cfg.NIVEL_ATENCAO) return "ATENCAO";
  return "NORMAL";
}

const ORDEM_FAIXA = { NORMAL: 0, ATENCAO: 1, CRITICO: 2 };

// P4 — classificação com histerese (deadband), ver docs/DASHBOARD_PROFISSIONAL.md
// §5 (ISA-18.2). Subir de faixa é imediato (não há motivo para atrasar um
// alarme de segurança), mas descer de faixa exige que o nível fique
// HISTERESE_M abaixo do limiar da faixa anterior — sem isso, um nível
// oscilando bem em cima de um limiar (ex.: 15,00 / 14,98 / 15,01 m) dispararia
// e cancelaria o alarme a cada ciclo ("chattering").
function classifyComHisterese(cfg, nivel, faixaAnterior) {
  const puro = classify(cfg, nivel);
  if (faixaAnterior === null) return puro; // primeiro ciclo — sem histerese

  if (ORDEM_FAIXA[puro] >= ORDEM_FAIXA[faixaAnterior]) {
    // Subida (ou mesma faixa): usa o limiar puro, sem atraso.
    return puro;
  }

  // Descida: só confirma o rebaixamento se houver folga suficiente abaixo
  // do limiar da faixa anterior; caso contrário mantém a faixa anterior.
  if (faixaAnterior === "CRITICO") {
    return nivel < cfg.NIVEL_CRITICO - cfg.HISTERESE_M ? puro : "CRITICO";
  }
  if (faixaAnterior === "ATENCAO") {
    return nivel < cfg.NIVEL_ATENCAO - cfg.HISTERESE_M ? puro : "ATENCAO";
  }
  return puro; // faixaAnterior === "NORMAL" — não há como descer mais
}

// Busca o último nível d'água de CADA piezômetro que teve leitura nos
// últimos 5 minutos. Idêntico em espírito a lerUltimosNiveis() do
// server.js, mas consultando o D1 em vez do InfluxDB.
async function lerUltimosNiveis(env) {
  const desde = Math.floor(Date.now() / 1000) - 300; // últimos 5 minutos

  const { results } = await env.DB.prepare(
    `SELECT l.piezometro, l.nivel_agua
       FROM leituras l
       JOIN (
         SELECT piezometro, MAX(id) AS mid
           FROM leituras
          WHERE ts >= ?1
          GROUP BY piezometro
       ) m ON l.id = m.mid`
  )
    .bind(desde)
    .all();

  const niveis = {};
  for (const row of results || []) {
    const valor = Number(row.nivel_agua);
    if (!Number.isFinite(valor)) continue;
    niveis[row.piezometro] = valor;
  }
  return niveis;
}

// P2 — busca a última leitura de CADA piezômetro já cadastrado, SEM janela
// de tempo (ao contrário de lerUltimosNiveis, que só enxerga quem falou nos
// últimos 5 min). É essa consulta sem filtro que permite detectar quando um
// instrumento parou de reportar: se ele sumisse da query, não haveria como
// saber há quanto tempo está mudo.
async function lerUltimasLeiturasTodas(env) {
  const { results } = await env.DB.prepare(
    `SELECT l.piezometro, l.nivel_agua, l.ts
       FROM leituras l
       JOIN (
         SELECT piezometro, MAX(id) AS mid FROM leituras GROUP BY piezometro
       ) m ON l.id = m.mid`
  ).all();

  const ultimas = {};
  for (const row of results || []) {
    ultimas[row.piezometro] = { nivel_agua: Number(row.nivel_agua), ts: Number(row.ts) };
  }
  return ultimas;
}

// P3 — busca, para um piezômetro, a leitura mais próxima (mais recente que
// não ultrapasse) de um instante-alvo no passado. Usada tanto pelo motor de
// alertas (taxa de variação) quanto por GET /ultimos (campo taxa_m_dia).
async function lerLeituraBaseline(env, piezometro, tsAlvo) {
  const { results } = await env.DB.prepare(
    `SELECT nivel_agua, ts FROM leituras
      WHERE piezometro = ?1 AND ts <= ?2
      ORDER BY ts DESC LIMIT 1`
  )
    .bind(piezometro, tsAlvo)
    .all();

  const row = results && results[0];
  if (!row) return null;
  return { nivel_agua: Number(row.nivel_agua), ts: Number(row.ts) };
}

// P3 — calcula a taxa de variação (m/dia) entre uma leitura atual e uma
// leitura-base, exigindo que o intervalo entre elas seja de pelo menos
// metade da janela configurada (evita taxa inflada por dois pontos quase
// simultâneos, ex.: piezômetro recém-cadastrado). Retorna null se não houver
// baseline válida.
function calcularTaxaMDia(cfg, atual, baseline) {
  if (!baseline) return null;
  const deltaSeg = atual.ts - baseline.ts;
  if (deltaSeg < (cfg.TAXA_JANELA_MIN * 60) / 2) return null;
  return ((atual.nivel_agua - baseline.nivel_agua) / deltaSeg) * 86400;
}

async function sendTelegram(cfg, text) {
  if (!cfg.telegramOn) return "desativado";
  try {
    const resp = await fetch(`https://api.telegram.org/bot${cfg.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: cfg.TELEGRAM_CHAT_ID, text }),
      signal: timeoutSignal(),
    });
    return resp.status === 200 ? "enviado" : `falha HTTP ${resp.status}`;
  } catch (e) {
    return `erro: ${e.message}`;
  }
}

async function sendSMS(cfg, text) {
  if (!cfg.smsOn) return "desativado";
  try {
    const form = new URLSearchParams({ Body: text, From: cfg.TWILIO_FROM, To: cfg.TWILIO_TO }).toString();
    const auth = btoa(`${cfg.TWILIO_ACCOUNT_SID}:${cfg.TWILIO_AUTH_TOKEN}`);
    const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cfg.TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
      signal: timeoutSignal(),
    });
    return resp.status === 201 ? "enviado" : `falha HTTP ${resp.status}`;
  } catch (e) {
    return `erro: ${e.message}`;
  }
}

async function notificar(cfg, alertLog, pz, nivel, valor) {
  const emoji = { NORMAL: "🟢", ATENCAO: "🟡", CRITICO: "🔴" }[nivel];
  const acao = {
    NORMAL: "Nível retornou à faixa segura.",
    ATENCAO: `Nível acima de ${cfg.NIVEL_ATENCAO} m — intensificar monitoramento.`,
    CRITICO: `Nível acima de ${cfg.NIVEL_CRITICO} m — ACIONAR EQUIPE DE GEOTECNIA!`,
  }[nivel];
  const text =
    `${emoji} SAMARCO PIEZÔMETRO ${pz} — ${nivel}\n` +
    `Nível d'água: ${valor.toFixed(2)} m\n${acao}\n` +
    `${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`;

  const [telegram, sms] = await Promise.all([
    sendTelegram(cfg, text),
    sendSMS(cfg, text),
  ]);

  const registro = { ts: new Date().toISOString(), tipo: "nivel", piezometro: pz, nivel, valor, telegram, sms };
  alertLog.unshift(registro);
  if (alertLog.length > 100) alertLog.pop();
  console.log(`🔔 Alerta ${pz} ${nivel} (${valor.toFixed(2)} m) — telegram: ${telegram} · sms: ${sms}`);
}

// P2 — notifica transição de estado de COMUNICAÇÃO (camada separada do
// alarme de nível). "silencioMin" só é relevante na transição OK→SEM_SINAL.
async function notificarComunicacao(cfg, alertLog, pz, status, ultimaLeituraTs, silencioMin) {
  const dataUltima = new Date(ultimaLeituraTs * 1000).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
  const text =
    status === "SEM_SINAL"
      ? `⚠️ SAMARCO PIEZÔMETRO ${pz} — SEM SINAL\n` +
        `Sem leituras há ${silencioMin} min (última: ${dataUltima}).\n` +
        `Verificar instrumento/comunicação.`
      : `🟢 SAMARCO PIEZÔMETRO ${pz} — COMUNICAÇÃO RESTABELECIDA\n` +
        `Instrumento voltou a reportar.`;

  const [telegram, sms] = await Promise.all([sendTelegram(cfg, text), sendSMS(cfg, text)]);

  const registro = { ts: new Date().toISOString(), tipo: "comunicacao", piezometro: pz, status, telegram, sms };
  alertLog.unshift(registro);
  if (alertLog.length > 100) alertLog.pop();
  console.log(`🔔 Comunicação ${pz} ${status} — telegram: ${telegram} · sms: ${sms}`);
}

// P3 — notifica transição de estado de TAXA DE VARIAÇÃO. "taxa"/"limite" só
// são relevantes na transição OK→TAXA_ALTA (na recuperação a mensagem é só
// informativa).
async function notificarTaxa(cfg, alertLog, pz, status, taxa, limite) {
  const text =
    status === "TAXA_ALTA"
      ? `📈 SAMARCO PIEZÔMETRO ${pz} — VARIAÇÃO RÁPIDA\n` +
        `Nível ${taxa >= 0 ? "subindo" : "descendo"} ${Math.abs(taxa).toFixed(2)} m/dia (limite ${limite})\n` +
        `Investigar mesmo dentro da faixa normal.`
      : `🟢 SAMARCO PIEZÔMETRO ${pz} — VARIAÇÃO NORMALIZADA\n` +
        `Taxa de variação voltou abaixo do limite.`;

  const [telegram, sms] = await Promise.all([sendTelegram(cfg, text), sendSMS(cfg, text)]);

  const registro = { ts: new Date().toISOString(), tipo: "taxa", piezometro: pz, status, taxa, telegram, sms };
  alertLog.unshift(registro);
  if (alertLog.length > 100) alertLog.pop();
  console.log(`🔔 Taxa ${pz} ${status} (${taxa != null ? taxa.toFixed(2) : "?"} m/dia) — telegram: ${telegram} · sms: ${sms}`);
}

// Estado persistido no KV — uma única chave "state", lida uma vez no início
// da execução do cron e gravada SÓ QUANDO ALGO MUDOU (checkAlerts retorna um
// flag de mutação). Na maioria dos ciclos nenhum piezômetro muda de faixa,
// então as escritas ficam muito abaixo do limite do free tier do KV
// (1000 writes/dia) mesmo com cron de 1 minuto.
function estadoVazio() {
  return {
    lastNotifiedLevel: {},
    lastCriticalNotify: {},
    commStatus: {}, // P2 — pz → "OK" | "SEM_SINAL"
    taxaStatus: {}, // P3 — pz → "OK" | "TAXA_ALTA"
    alertLog: [],
  };
}

async function lerEstado(env) {
  const raw = await env.ALERT_STATE.get("state");
  if (!raw) return estadoVazio();
  try {
    const parsed = JSON.parse(raw);
    return {
      lastNotifiedLevel: parsed.lastNotifiedLevel || {},
      lastCriticalNotify: parsed.lastCriticalNotify || {},
      commStatus: parsed.commStatus || {},
      taxaStatus: parsed.taxaStatus || {},
      alertLog: Array.isArray(parsed.alertLog) ? parsed.alertLog : [],
    };
  } catch {
    return estadoVazio();
  }
}

async function salvarEstado(env, estado) {
  if (estado.alertLog.length > 100) estado.alertLog = estado.alertLog.slice(0, 100);
  await env.ALERT_STATE.put("state", JSON.stringify(estado));
}

// Port de checkAlerts() do server.js, operando sobre o estado carregado do KV.
// Retorna true se o estado foi modificado (e portanto precisa ser regravado).
async function checkAlerts(cfg, env, estado) {
  let mutou = false;
  try {
    // Camada de NÍVEL — só enxerga quem teve leitura nos últimos 5 minutos.
    // Um piezômetro em SEM_SINAL simplesmente não aparece aqui: dado ausente
    // não conta como NORMAL, então ele fica de fora da avaliação de nível
    // (em vez de "puxar" a última leitura antiga e mascarar o silêncio).
    const niveis = await lerUltimosNiveis(env);
    const agora = Date.now();
    const agoraSeg = Math.floor(agora / 1000);

    for (const [pz, valor] of Object.entries(niveis)) {
      const anterior = Object.prototype.hasOwnProperty.call(estado.lastNotifiedLevel, pz)
        ? estado.lastNotifiedLevel[pz]
        : null; // null = primeiro ciclo deste piezômetro (não notifica NORMAL)
      // P4 — histerese só se aplica à descida; classify() puro decide a
      // subida (ver classifyComHisterese()).
      const nivel = classifyComHisterese(cfg, valor, anterior);
      const mudouDeFaixa = nivel !== anterior;
      const repetirCritico = nivel === "CRITICO" &&
        agora - (estado.lastCriticalNotify[pz] || 0) >= cfg.ALERT_REPEAT_MIN * 60000;

      if (mudouDeFaixa || repetirCritico) {
        if (anterior !== null || nivel !== "NORMAL") {
          await notificar(cfg, estado.alertLog, pz, nivel, valor);
          if (nivel === "CRITICO") estado.lastCriticalNotify[pz] = agora;
        }
        estado.lastNotifiedLevel[pz] = nivel;
        mutou = true;
      }

      // P3 — taxa de variação, só avaliada para quem tem leitura recente
      // (mesmo conjunto acima). Compara com a leitura mais próxima de
      // "agora - TAXA_JANELA_MIN".
      const tsAlvo = agoraSeg - cfg.TAXA_JANELA_MIN * 60;
      const baseline = await lerLeituraBaseline(env, pz, tsAlvo);
      const taxa = calcularTaxaMDia(cfg, { nivel_agua: valor, ts: agoraSeg }, baseline);

      if (taxa !== null) {
        const statusTaxa = Math.abs(taxa) > cfg.TAXA_MAX_M_DIA ? "TAXA_ALTA" : "OK";
        const statusTaxaAnterior = estado.taxaStatus[pz] || "OK";
        if (statusTaxa !== statusTaxaAnterior) {
          await notificarTaxa(cfg, estado.alertLog, pz, statusTaxa, taxa, cfg.TAXA_MAX_M_DIA);
          estado.taxaStatus[pz] = statusTaxa;
          mutou = true;
        }
      }
    }

    // Camada de COMUNICAÇÃO (P2) — consulta TODOS os piezômetros já
    // cadastrados, sem janela de tempo, para detectar silêncio prolongado.
    // É deliberadamente separada da camada de nível acima.
    const ultimas = await lerUltimasLeiturasTodas(env);
    for (const [pz, leitura] of Object.entries(ultimas)) {
      const silencioSeg = agoraSeg - leitura.ts;
      const statusComm = silencioSeg > cfg.SILENCE_ALERT_SEC ? "SEM_SINAL" : "OK";
      const statusCommAnterior = estado.commStatus[pz] || "OK";

      if (statusComm !== statusCommAnterior) {
        const silencioMin = Math.round(silencioSeg / 60);
        await notificarComunicacao(cfg, estado.alertLog, pz, statusComm, leitura.ts, silencioMin);
        estado.commStatus[pz] = statusComm;
        mutou = true;
      }
    }
  } catch (e) {
    console.error("Motor de alertas:", e.message);
  }
  return mutou;
}

// ── ROTAS HTTP ────────────────────────────────────────────────────────────────

async function handleIngest(request, env, cfg) {
  if (cfg.DEVICE_KEY && request.headers.get("x-device-key") !== cfg.DEVICE_KEY) {
    return json(cfg, 401, { error: "Chave de dispositivo inválida" });
  }

  const { tooLarge, text } = await readBodyLimited(request, INGEST_MAX_BYTES);
  if (tooLarge) return json(cfg, 413, { error: "Payload muito grande" });

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    return json(cfg, 400, { error: "JSON inválido" });
  }

  const leituras = Array.isArray(payload && payload.leituras) ? payload.leituras : [payload];

  if (!leituras.length) {
    return json(cfg, 400, { error: "Nenhuma leitura enviada" });
  }
  if (leituras.length > INGEST_MAX_LEITURAS) {
    return json(cfg, 400, { error: "Máximo de 200 leituras por lote" });
  }

  const normalizadas = [];
  for (const leitura of leituras) {
    const norm = normalizarLeitura(leitura);
    if (!norm) {
      return json(cfg, 400, { error: "Campo 'nivel_agua' é obrigatório e deve ser um número finito" });
    }
    normalizadas.push(norm);
  }

  try {
    const stmt = env.DB.prepare(
      "INSERT INTO leituras (piezometro, nivel_agua, pressao, temperatura, ts) VALUES (?1, ?2, ?3, ?4, ?5)"
    );
    const batch = normalizadas.map((l) =>
      stmt.bind(l.piezometro, l.nivel_agua, l.pressao, l.temperatura, l.ts)
    );
    await env.DB.batch(batch);

    console.log(`📥 Ingestão: ${normalizadas.length} leitura(s) gravada(s) no D1`);
    return new Response(null, { status: 204, headers: corsHeaders(cfg) });
  } catch (e) {
    console.error("📥 Ingestão: erro ao gravar no D1:", e.message);
    return json(cfg, 502, { error: e.message });
  }
}

// GET /ultimos — última leitura de cada piezômetro, para o dashboard exibir
// o status atual sem precisar varrer o histórico inteiro.
async function handleUltimos(env, cfg) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT l.piezometro, l.nivel_agua, l.pressao, l.temperatura, l.ts
         FROM leituras l
         JOIN (
           SELECT piezometro, MAX(id) AS mid FROM leituras GROUP BY piezometro
         ) m ON l.id = m.mid`
    ).all();

    const out = {};
    for (const row of results || []) {
      // P3 — taxa de variação (m/dia) desde a leitura mais próxima de
      // "agora - TAXA_JANELA_MIN", mesmo cálculo usado no motor de alertas.
      // null quando ainda não há baseline suficiente (instrumento novo).
      const tsAlvo = row.ts - cfg.TAXA_JANELA_MIN * 60;
      const baseline = await lerLeituraBaseline(env, row.piezometro, tsAlvo);
      const taxa = calcularTaxaMDia(
        cfg,
        { nivel_agua: Number(row.nivel_agua), ts: Number(row.ts) },
        baseline
      );

      out[row.piezometro] = {
        nivel_agua: row.nivel_agua,
        pressao: row.pressao,
        temperatura: row.temperatura,
        ts: row.ts,
        taxa_m_dia: taxa,
      };
    }
    return json(cfg, 200, out);
  } catch (e) {
    console.error("/ultimos:", e.message);
    return json(cfg, 502, { error: e.message });
  }
}

// GET /dados?pz=PZ-01&range=24h — série histórica agregada em buckets, para
// alimentar os gráficos do dashboard sem devolver ponto a ponto (que num
// device relatando a cada poucos segundos viraria uma resposta enorme).
async function handleDados(url, env, cfg) {
  const pzParam = url.searchParams.get("pz") || "PZ-01";
  if (!PIEZOMETRO_ID_RE.test(pzParam)) {
    return json(cfg, 400, { error: "Parâmetro 'pz' inválido" });
  }

  const rangeParam = url.searchParams.get("range") || "24h";
  const range = RANGES[rangeParam];
  if (!range) {
    return json(cfg, 400, { error: "Parâmetro 'range' deve ser um de: 24h, 7d, 30d" });
  }

  const desde = Math.floor(Date.now() / 1000) - range.janela;

  try {
    const { results } = await env.DB.prepare(
      `SELECT CAST(ts / ?1 AS INTEGER) * ?1 AS t,
              AVG(nivel_agua) AS nivel_agua,
              MAX(nivel_agua) AS nivel_max,
              AVG(pressao) AS pressao,
              AVG(temperatura) AS temperatura
         FROM leituras
        WHERE piezometro = ?2 AND ts >= ?3
        GROUP BY t
        ORDER BY t`
    )
      .bind(range.bucket, pzParam, desde)
      .all();

    // P5 — a MÉDIA do bucket mascara excursões breves acima do limiar (ex.:
    // um pico de 15,3 m por 2 min dentro de um bucket de 30 min vira uma
    // média de 12,1 m no gráfico). nivel_max preserva o PICO, que é o que
    // importa em monitoramento de segurança — ver
    // docs/DASHBOARD_PROFISSIONAL.md §5.
    const pontos = (results || []).map((row) => ({
      ts: row.t,
      nivel_agua: row.nivel_agua,
      nivel_max: row.nivel_max,
      pressao: row.pressao,
      temperatura: row.temperatura,
    }));

    return json(cfg, 200, { pz: pzParam, range: rangeParam, pontos });
  } catch (e) {
    console.error("/dados:", e.message);
    return json(cfg, 502, { error: e.message });
  }
}

async function handleAlerts(env, cfg) {
  const estado = await lerEstado(env);
  return json(cfg, 200, {
    canais: { telegram: cfg.telegramOn, sms: cfg.smsOn },
    limiares: { atencao: cfg.NIVEL_ATENCAO, critico: cfg.NIVEL_CRITICO },
    piezometros: { ...estado.lastNotifiedLevel },
    comunicacao: { ...estado.commStatus }, // P2
    taxas: { ...estado.taxaStatus }, // P3
    notificacoes: estado.alertLog.slice(0, 50),
  });
}

// GET /config — fonte única de verdade dos contratos que hoje ficam
// duplicados "na mão" no firmware e no dashboard (limiares de alerta,
// ranges aceitos por /dados e o catálogo de piezômetros cadastrados). Os
// níveis de controle (atenção/crítico) são definidos por projeto pelo
// projetista geotécnico — parametrização é requisito do domínio, não um
// detalhe de implementação — então o dashboard carrega isso no boot em vez
// de hard-codar, evitando os três lugares ficarem fora de sincronia.
function handleConfig(env, cfg) {
  let piezometros = [];
  try {
    const parsed = JSON.parse(env.PIEZOMETROS || "[]");
    if (Array.isArray(parsed)) piezometros = parsed;
  } catch {
    piezometros = [];
  }

  return json(cfg, 200, {
    limiares: { atencao: cfg.NIVEL_ATENCAO, critico: cfg.NIVEL_CRITICO },
    ranges: Object.keys(RANGES),
    piezometros,
    stale_seg: cfg.STALE_SEG, // P2 — janela que o dashboard usa p/ marcar "sem sinal" na UI
    taxa_max_m_dia: cfg.TAXA_MAX_M_DIA, // P3 — limiar de variação rápida
    histerese_m: cfg.HISTERESE_M, // P4 — deadband de descida de faixa (ISA-18.2)
  });
}

function handleHealth(cfg) {
  return json(cfg, 200, {
    status: "ok",
    ts: new Date().toISOString(),
    db: "D1",
    alertas: { telegram: cfg.telegramOn, sms: cfg.smsOn, cron: "1min" },
  });
}

// ── EXPORT DO WORKER ──────────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const cfg = getConfig(env);
    const url = new URL(request.url);

    // Preflight CORS
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(cfg) });
    }

    console.log(`${request.method} ${url.pathname}`);

    try {
      if (request.method === "POST" && url.pathname === "/ingest") {
        return await handleIngest(request, env, cfg);
      }
      if (url.pathname === "/ultimos") {
        return await handleUltimos(env, cfg);
      }
      if (url.pathname === "/dados") {
        return await handleDados(url, env, cfg);
      }
      if (url.pathname === "/alerts") {
        return await handleAlerts(env, cfg);
      }
      if (url.pathname === "/config") {
        return handleConfig(env, cfg);
      }
      if (url.pathname === "/health") {
        return handleHealth(cfg);
      }
    } catch (e) {
      console.error("Erro não tratado:", e.message);
      return json(cfg, 500, { error: e.message });
    }

    // Sem servir index.html: o dashboard é hospedado no GitHub Pages, não no
    // Worker — mantém o worker enxuto e focado no que precisa de backend.
    return json(cfg, 404, { error: "Not found" });
  },

  // Motor de alertas ativos — antes era setInterval(checkAlerts, ...) no
  // server.js; aqui roda pelo cron trigger definido em wrangler.toml
  // ([triggers] crons = ["* * * * *"]).
  async scheduled(event, env, ctx) {
    const cfg = getConfig(env);
    ctx.waitUntil((async () => {
      const estado = await lerEstado(env);
      const mutou = await checkAlerts(cfg, env, estado);
      // Só grava se algo mudou — respeita o limite de escritas do KV free tier
      if (mutou) await salvarEstado(env, estado);
    })());
  },
};
