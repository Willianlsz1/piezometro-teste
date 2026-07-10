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
function classify(cfg, n) {
  if (n >= cfg.NIVEL_CRITICO) return "CRITICO";
  if (n >= cfg.NIVEL_ATENCAO) return "ATENCAO";
  return "NORMAL";
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

  const registro = { ts: new Date().toISOString(), piezometro: pz, nivel, valor, telegram, sms };
  alertLog.unshift(registro);
  if (alertLog.length > 100) alertLog.pop();
  console.log(`🔔 Alerta ${pz} ${nivel} (${valor.toFixed(2)} m) — telegram: ${telegram} · sms: ${sms}`);
}

// Estado persistido no KV — uma única chave "state", lida uma vez no início
// da execução do cron e gravada SÓ QUANDO ALGO MUDOU (checkAlerts retorna um
// flag de mutação). Na maioria dos ciclos nenhum piezômetro muda de faixa,
// então as escritas ficam muito abaixo do limite do free tier do KV
// (1000 writes/dia) mesmo com cron de 1 minuto.
async function lerEstado(env) {
  const raw = await env.ALERT_STATE.get("state");
  if (!raw) {
    return { lastNotifiedLevel: {}, lastCriticalNotify: {}, alertLog: [] };
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      lastNotifiedLevel: parsed.lastNotifiedLevel || {},
      lastCriticalNotify: parsed.lastCriticalNotify || {},
      alertLog: Array.isArray(parsed.alertLog) ? parsed.alertLog : [],
    };
  } catch {
    return { lastNotifiedLevel: {}, lastCriticalNotify: {}, alertLog: [] };
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
    const niveis = await lerUltimosNiveis(env);
    const agora = Date.now();

    for (const [pz, valor] of Object.entries(niveis)) {
      const nivel = classify(cfg, valor);
      const anterior = Object.prototype.hasOwnProperty.call(estado.lastNotifiedLevel, pz)
        ? estado.lastNotifiedLevel[pz]
        : null; // null = primeiro ciclo deste piezômetro (não notifica NORMAL)
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
      out[row.piezometro] = {
        nivel_agua: row.nivel_agua,
        pressao: row.pressao,
        temperatura: row.temperatura,
        ts: row.ts,
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
              AVG(pressao) AS pressao,
              AVG(temperatura) AS temperatura
         FROM leituras
        WHERE piezometro = ?2 AND ts >= ?3
        GROUP BY t
        ORDER BY t`
    )
      .bind(range.bucket, pzParam, desde)
      .all();

    const pontos = (results || []).map((row) => ({
      ts: row.t,
      nivel_agua: row.nivel_agua,
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
    notificacoes: estado.alertLog.slice(0, 50),
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
