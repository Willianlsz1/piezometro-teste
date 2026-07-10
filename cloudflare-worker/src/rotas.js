// ── ROTAS HTTP ────────────────────────────────────────────────────────────────
// Um handler por endpoint (/ingest, /ultimos, /dados, /alerts, /config,
// /health) — orquestram config, db e alertas para montar a resposta JSON.

import { RANGES, PIEZOMETRO_ID_RE, INGEST_MAX_BYTES, INGEST_MAX_LEITURAS } from "./config.js";
import { corsHeaders, json, readBodyLimited } from "./http.js";
import { normalizarLeitura, inserirLeituras, lerUltimasLeiturasTodas, lerLeituraBaseline, lerDadosAgregados } from "./db.js";
import { calcularTaxaMDia, lerEstado } from "./alertas.js";

export async function handleIngest(request, env, cfg) {
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
    await inserirLeituras(env, normalizadas);

    console.log(`📥 Ingestão: ${normalizadas.length} leitura(s) gravada(s) no D1`);
    return new Response(null, { status: 204, headers: corsHeaders(cfg) });
  } catch (e) {
    console.error("📥 Ingestão: erro ao gravar no D1:", e.message);
    return json(cfg, 502, { error: e.message });
  }
}

// GET /ultimos — última leitura de cada piezômetro, para o dashboard exibir
// o status atual sem precisar varrer o histórico inteiro.
export async function handleUltimos(env, cfg) {
  try {
    const ultimas = await lerUltimasLeiturasTodas(env);

    const out = {};
    for (const [pz, row] of Object.entries(ultimas)) {
      // P3 — taxa de variação (m/dia) desde a leitura mais próxima de
      // "agora - TAXA_JANELA_MIN", mesmo cálculo usado no motor de alertas.
      // null quando ainda não há baseline suficiente (instrumento novo).
      const tsAlvo = row.ts - cfg.TAXA_JANELA_MIN * 60;
      const baseline = await lerLeituraBaseline(env, pz, tsAlvo);
      const taxa = calcularTaxaMDia(cfg, { nivel_agua: row.nivel_agua, ts: row.ts }, baseline);

      out[pz] = {
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
export async function handleDados(url, env, cfg) {
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
    const linhas = await lerDadosAgregados(env, pzParam, range, desde);

    // P5 — a MÉDIA do bucket mascara excursões breves acima do limiar (ex.:
    // um pico de 15,3 m por 2 min dentro de um bucket de 30 min vira uma
    // média de 12,1 m no gráfico). nivel_max preserva o PICO, que é o que
    // importa em monitoramento de segurança — ver
    // docs/DASHBOARD_PROFISSIONAL.md §5.
    const pontos = linhas.map((row) => ({
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

export async function handleAlerts(env, cfg) {
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
export function handleConfig(env, cfg) {
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

export function handleHealth(cfg) {
  return json(cfg, 200, {
    status: "ok",
    ts: new Date().toISOString(),
    db: "D1",
    alertas: { telegram: cfg.telegramOn, sms: cfg.smsOn, cron: "1min" },
  });
}
