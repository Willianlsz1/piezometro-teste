const http  = require("http");
const https = require("https");
const fs    = require("fs");
const path  = require("path");

try { require("dotenv").config(); } catch { /* dotenv opcional em produção */ }

// ── CONFIG ────────────────────────────────────────────────────────────────────
const PORT         = process.env.PORT         || 3000;
const INFLUX_URL   = process.env.INFLUX_URL   || "https://us-east-1-1.aws.cloud2.influxdata.com";
const INFLUX_TOKEN = process.env.INFLUX_TOKEN || "";
const INFLUX_ORG   = process.env.INFLUX_ORG   || "SAMARCO";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const ALLOWED_BUCKET = process.env.ALLOWED_BUCKET || "PIEZOMETRO";
const MEASUREMENT    = process.env.INFLUX_MEASUREMENT || "telemetria_samarco";

// Token com permissão de ESCRITA (usado só pelo /ingest); se ausente, usa o INFLUX_TOKEN
const INFLUX_WRITE_TOKEN = process.env.INFLUX_WRITE_TOKEN || INFLUX_TOKEN;
// Chave compartilhada da placa (header x-device-key); se vazia, /ingest aceita
// sem autenticação — apenas para desenvolvimento
const DEVICE_KEY = process.env.DEVICE_KEY || "";

// ── CONFIG DOS ALERTAS ATIVOS (Telegram / SMS) ───────────────────────────────
// Limiares de nível d'água (m) — espelhados no firmware e no dashboard
const NIVEL_ATENCAO    = parseFloat(process.env.NIVEL_ATENCAO || "12");
const NIVEL_CRITICO    = parseFloat(process.env.NIVEL_CRITICO || "15");
const ALERT_POLL_SEC   = parseInt(process.env.ALERT_POLL_SEC || "60", 10);
const ALERT_REPEAT_MIN = parseInt(process.env.ALERT_REPEAT_MIN || "15", 10);

// Telegram (gratuito): crie um bot com o @BotFather e pegue o chat_id
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID   = process.env.TELEGRAM_CHAT_ID   || "";

// SMS via Twilio (opcional, pago): https://www.twilio.com/console
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH_TOKEN  = process.env.TWILIO_AUTH_TOKEN  || "";
const TWILIO_FROM        = process.env.TWILIO_FROM        || "";
const TWILIO_TO          = process.env.TWILIO_TO          || "";

const telegramOn = !!(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID);
const smsOn      = !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM && TWILIO_TO);

if (!INFLUX_TOKEN) {
  console.error("❌  INFLUX_TOKEN não definido. Defina no arquivo .env ou nas variáveis de ambiente.");
  process.exit(1);
}

const MAX_BODY_BYTES   = 8 * 1024;
const INGEST_MAX_BYTES = 64 * 1024; // /ingest recebe lotes do store & forward, por isso um limite maior que o /query

// ── HELPERS ───────────────────────────────────────────────────────────────────
function sendJSON(res, status, obj) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  });
  res.end(JSON.stringify(obj));
}

function setCORSHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin",  ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Vary", "Origin");
}

// Requisição HTTPS genérica que devolve Promise<{status, body}>
function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (r) => {
      let data = "";
      r.on("data", (c) => (data += c));
      r.on("end", () => resolve({ status: r.statusCode, body: data }));
    });
    req.setTimeout(15000, () => req.destroy(new Error("Timeout (15s)")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

// ── PROXY INFLUXDB (usado pelo dashboard) ────────────────────────────────────
function proxyToInflux(flux, res) {
  const url  = new URL(`${INFLUX_URL}/api/v2/query?org=${encodeURIComponent(INFLUX_ORG)}`);
  const body = Buffer.from(flux, "utf8");

  const req = https.request(
    {
      hostname: url.hostname,
      port:     url.port || 443,   // respeita porta não padrão (ex.: self-hosted :8086)
      path:     url.pathname + url.search,
      method:   "POST",
      timeout:  15000,
      headers: {
        "Authorization":  `Token ${INFLUX_TOKEN}`,
        "Content-Type":   "application/vnd.flux",
        "Accept":         "application/csv",
        "Content-Length": body.length,
      },
    },
    (influxRes) => {
      res.writeHead(influxRes.statusCode, {
        "Content-Type":                 "application/csv",
        "Access-Control-Allow-Origin":  ALLOWED_ORIGIN,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Vary":                         "Origin",
      });
      influxRes.pipe(res);
    }
  );

  req.on("timeout", () => {
    req.destroy(new Error("Timeout ao conectar no InfluxDB (15s)"));
  });

  req.on("error", (e) => {
    console.error("Proxy InfluxDB error:", e.message);
    res.writeHead(502, {
      "Content-Type":                "application/json",
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    });
    res.end(JSON.stringify({ error: e.message }));
  });

  req.write(body);
  req.end();
}

// ── INGESTÃO (placa → InfluxDB) ──────────────────────────────────────────────
// A placa ESP32 não fala mais direto com o InfluxDB: ela posta em /ingest e o
// servidor converte para line protocol e grava, usando o token de escrita.
// Assim nenhum token do InfluxDB fica no firmware — só a DEVICE_KEY.

// Converte uma leitura {nivel_agua, pressao?, temperatura?, ts?} em uma linha
// de line protocol do InfluxDB. Retorna null se nivel_agua não for válido.
function leituraParaLinha(leitura) {
  if (!leitura || typeof leitura !== "object") return null;

  const nivel = leitura.nivel_agua;
  if (typeof nivel !== "number" || !Number.isFinite(nivel)) return null;

  const campos = [`nivel_agua=${nivel}`];
  if (typeof leitura.pressao === "number" && Number.isFinite(leitura.pressao)) {
    campos.push(`pressao=${leitura.pressao}`);
  }
  if (typeof leitura.temperatura === "number" && Number.isFinite(leitura.temperatura)) {
    campos.push(`temperatura=${leitura.temperatura}`);
  }

  let linha = `${MEASUREMENT} ${campos.join(",")}`;

  // ts em segundos (epoch) → nanossegundos, montado como string para não
  // perder precisão. Só aceita valores razoáveis; fora disso, omite o
  // timestamp e deixa o InfluxDB carimbar com o horário de chegada.
  const ts = leitura.ts;
  if (Number.isInteger(ts) && ts > 1e9 && ts < 1e11) {
    linha += ` ${ts}000000000`;
  }

  return linha;
}

// Grava um bloco de line protocol (uma ou mais linhas separadas por "\n") no
// bucket permitido, usando o token de escrita.
function escreverNoInflux(lineProtocol) {
  const url = new URL(
    `${INFLUX_URL}/api/v2/write?org=${encodeURIComponent(INFLUX_ORG)}&bucket=${encodeURIComponent(ALLOWED_BUCKET)}&precision=ns`
  );
  const body = Buffer.from(lineProtocol, "utf8");

  return httpsRequest(
    {
      hostname: url.hostname,
      port:     url.port || 443,   // respeita porta não padrão (ex.: self-hosted :8086)
      path:     url.pathname + url.search,
      method:   "POST",
      headers: {
        "Authorization":  `Token ${INFLUX_WRITE_TOKEN}`,
        "Content-Type":   "text/plain; charset=utf-8",
        "Content-Length": body.length,
      },
    },
    body
  );
}

// ── MOTOR DE ALERTAS ATIVOS ───────────────────────────────────────────────────
// O servidor vigia o InfluxDB e dispara Telegram/SMS quando o nível d'água
// muda de faixa — cumprindo o requisito de "alertas preventivos" da demanda
// SAGA sem depender de ninguém estar olhando o dashboard.
let lastNotifiedLevel = null;   // null = primeiro ciclo (não notifica NORMAL)
let lastCriticalNotify = 0;
const alertLog = [];            // histórico exposto em GET /alerts

function classify(n) {
  if (n >= NIVEL_CRITICO) return "CRITICO";
  if (n >= NIVEL_ATENCAO) return "ATENCAO";
  return "NORMAL";
}

async function lerUltimoNivel() {
  const flux = `
from(bucket: "${ALLOWED_BUCKET}")
  |> range(start: -5m)
  |> filter(fn: (r) => r._measurement == "${MEASUREMENT}")
  |> filter(fn: (r) => r._field == "nivel_agua")
  |> last()`;

  const url = new URL(`${INFLUX_URL}/api/v2/query?org=${encodeURIComponent(INFLUX_ORG)}`);
  const { status, body } = await httpsRequest(
    {
      hostname: url.hostname,
      port:     url.port || 443,   // respeita porta não padrão (ex.: self-hosted :8086)
      path:     url.pathname + url.search,
      method:   "POST",
      headers: {
        "Authorization": `Token ${INFLUX_TOKEN}`,
        "Content-Type":  "application/vnd.flux",
        "Accept":        "application/csv",
      },
    },
    flux
  );
  if (status !== 200) return null;

  // CSV anotado do Influx: acha a coluna _value na linha de cabeçalho
  const lines = body.trim().split("\n").filter((l) => l && !l.startsWith("#"));
  if (lines.length < 2) return null;
  const header = lines[0].split(",");
  const iV = header.indexOf("_value");
  if (iV < 0) return null;
  const v = parseFloat(lines[1].split(",")[iV]);
  return Number.isFinite(v) ? v : null;
}

async function sendTelegram(text) {
  if (!telegramOn) return "desativado";
  const payload = JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text });
  const { status } = await httpsRequest(
    {
      hostname: "api.telegram.org",
      path:     `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      method:   "POST",
      headers:  { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
    },
    payload
  );
  return status === 200 ? "enviado" : `falha HTTP ${status}`;
}

async function sendSMS(text) {
  if (!smsOn) return "desativado";
  const form = new URLSearchParams({ Body: text, From: TWILIO_FROM, To: TWILIO_TO }).toString();
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
  const { status } = await httpsRequest(
    {
      hostname: "api.twilio.com",
      path:     `/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      method:   "POST",
      headers: {
        "Authorization":  `Basic ${auth}`,
        "Content-Type":   "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(form),
      },
    },
    form
  );
  return status === 201 ? "enviado" : `falha HTTP ${status}`;
}

async function notificar(nivel, valor) {
  const emoji = { NORMAL: "🟢", ATENCAO: "🟡", CRITICO: "🔴" }[nivel];
  const acao = {
    NORMAL:  "Nível retornou à faixa segura.",
    ATENCAO: `Nível acima de ${NIVEL_ATENCAO} m — intensificar monitoramento.`,
    CRITICO: `Nível acima de ${NIVEL_CRITICO} m — ACIONAR EQUIPE DE GEOTECNIA!`,
  }[nivel];
  const text =
    `${emoji} SAMARCO PIEZÔMETRO — ${nivel}\n` +
    `Nível d'água: ${valor.toFixed(2)} m\n${acao}\n` +
    `${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`;

  const [telegram, sms] = await Promise.all([
    sendTelegram(text).catch((e) => `erro: ${e.message}`),
    sendSMS(text).catch((e) => `erro: ${e.message}`),
  ]);

  const registro = { ts: new Date().toISOString(), nivel, valor, telegram, sms };
  alertLog.unshift(registro);
  if (alertLog.length > 100) alertLog.pop();
  console.log(`🔔 Alerta ${nivel} (${valor.toFixed(2)} m) — telegram: ${telegram} · sms: ${sms}`);
}

async function checkAlerts() {
  try {
    const valor = await lerUltimoNivel();
    if (valor === null) return; // sem dados recentes — nada a fazer

    const nivel = classify(valor);
    const agora = Date.now();
    const mudouDeFaixa   = nivel !== lastNotifiedLevel;
    const repetirCritico = nivel === "CRITICO" &&
                           agora - lastCriticalNotify >= ALERT_REPEAT_MIN * 60000;

    if (mudouDeFaixa || repetirCritico) {
      // No primeiro ciclo após o boot, só notifica se já estiver fora do normal
      if (lastNotifiedLevel !== null || nivel !== "NORMAL") {
        await notificar(nivel, valor);
        if (nivel === "CRITICO") lastCriticalNotify = agora;
      }
      lastNotifiedLevel = nivel;
    }
  } catch (e) {
    console.error("Motor de alertas:", e.message);
  }
}

// ── SERVIDOR ──────────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  setCORSHeaders(res);

  // Preflight CORS
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  // Rate limiting — aplicado apenas em /query para proteger o proxy InfluxDB
  if (url.pathname === "/query") {
    if (!checkRateLimit(ip)) {
      metrics.blockedByRate++;
      log("WARN", "Rate limit excedido", { ip, path: url.pathname });
      return sendJSON(res, 429, { error: "Too Many Requests — máximo 10 req/s por IP" });
    }
  }

  log("INFO", `${req.method} ${url.pathname}`, { ip });

  // /query → proxy para InfluxDB
  if (req.method === "POST" && url.pathname === "/query") {
    let body  = "";
    let bytes = 0;

    req.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        req.destroy();
        return sendJSON(res, 413, { error: "Payload muito grande" });
      }
      body += chunk;
    });

    req.on("end", () => {
      if (!body.trim()) return sendJSON(res, 400, { error: "Body vazio" });

      // Segurança: o proxy só repassa queries que leem o bucket permitido.
      // Sem isso, qualquer pessoa com a URL poderia executar Flux arbitrário
      // (listar/ler outros buckets da organização) usando o nosso token.
      const buckets = [...body.matchAll(/from\s*\(\s*bucket\s*:\s*"([^"]*)"/g)].map((m) => m[1]);
      if (!buckets.length || buckets.some((b) => b !== ALLOWED_BUCKET)) {
        return sendJSON(res, 403, {
          error: `Apenas consultas ao bucket "${ALLOWED_BUCKET}" são permitidas`,
        });
      }

      proxyToInflux(body, res);
    });

    return;
  }

  // /ingest → recebe leituras da placa (única ou em lote) e grava no InfluxDB
  if (req.method === "POST" && url.pathname === "/ingest") {
    if (DEVICE_KEY && req.headers["x-device-key"] !== DEVICE_KEY) {
      return sendJSON(res, 401, { error: "Chave de dispositivo inválida" });
    }

    let body  = "";
    let bytes = 0;

    req.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > INGEST_MAX_BYTES) {
        req.destroy();
        return sendJSON(res, 413, { error: "Payload muito grande" });
      }
      body += chunk;
    });

    req.on("end", async () => {
      let payload;
      try {
        payload = JSON.parse(body);
      } catch {
        return sendJSON(res, 400, { error: "JSON inválido" });
      }

      const leituras = Array.isArray(payload && payload.leituras) ? payload.leituras : [payload];

      if (!leituras.length) {
        return sendJSON(res, 400, { error: "Nenhuma leitura enviada" });
      }
      if (leituras.length > 200) {
        return sendJSON(res, 400, { error: "Máximo de 200 leituras por lote" });
      }

      const linhas = [];
      for (const leitura of leituras) {
        const linha = leituraParaLinha(leitura);
        if (!linha) {
          return sendJSON(res, 400, { error: "Campo 'nivel_agua' é obrigatório e deve ser um número finito" });
        }
        linhas.push(linha);
      }

      try {
        const { status } = await escreverNoInflux(linhas.join("\n"));
        if (status !== 204) {
          console.error(`📥 Ingestão: InfluxDB rejeitou a escrita (HTTP ${status})`);
          return sendJSON(res, 502, { error: `InfluxDB rejeitou a escrita (HTTP ${status})` });
        }
        console.log(`📥 Ingestão: ${linhas.length} leitura(s) gravada(s) no InfluxDB`);
        res.writeHead(204, { "Access-Control-Allow-Origin": ALLOWED_ORIGIN });
        return res.end();
      } catch (e) {
        console.error("📥 Ingestão: erro ao gravar no InfluxDB:", e.message);
        return sendJSON(res, 502, { error: e.message });
      }
    });

    return;
  }

  // /alerts → histórico de notificações do motor de alertas
  if (url.pathname === "/alerts") {
    return sendJSON(res, 200, {
      canais:   { telegram: telegramOn, sms: smsOn },
      limiares: { atencao: NIVEL_ATENCAO, critico: NIVEL_CRITICO },
      notificacoes: alertLog.slice(0, 50),
    });
  }

  // /health → status
  if (url.pathname === "/health") {
    return sendJSON(res, 200, {
      status: "ok",
      ts:     new Date().toISOString(),
      influx: INFLUX_URL,
      alertas: { telegram: telegramOn, sms: smsOn, pollSec: ALERT_POLL_SEC },
    });
  }

  // / → serve o dashboard HTML
  if (url.pathname === "/" || url.pathname === "/index.html") {
    const file = path.join(__dirname, "index.html");
    if (fs.existsSync(file)) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return fs.createReadStream(file).pipe(res);
    }
  }

  sendJSON(res, 404, { error: "Not found" });
});

// ── GRACEFUL SHUTDOWN ─────────────────────────────────────────────────────────
function shutdown(signal) {
  console.log(`\n⚠️  ${signal} recebido — encerrando servidor...`);
  server.close(() => {
    console.log("✅ Servidor encerrado com sucesso.");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

// ── START ─────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`✅ Piezômetro proxy rodando em http://0.0.0.0:${PORT}`);
  console.log(`   → Dashboard:  http://0.0.0.0:${PORT}/`);
  console.log(`   → Health:     http://0.0.0.0:${PORT}/health`);
  console.log(`   → Proxy:      http://0.0.0.0:${PORT}/query`);
  console.log(`   → Ingestão:  http://0.0.0.0:${PORT}/ingest`);
  console.log(`   → Alertas:    http://0.0.0.0:${PORT}/alerts`);
  console.log(`🔔 Notificações — Telegram: ${telegramOn ? "ATIVO" : "desativado"} · SMS (Twilio): ${smsOn ? "ATIVO" : "desativado"}`);
  if (!telegramOn && !smsOn) {
    console.log("   (defina TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID ou TWILIO_* para ativar)");
  }
  setInterval(checkAlerts, ALERT_POLL_SEC * 1000);
  checkAlerts();
});

module.exports = { server, metrics, checkRateLimit }; // Exportado para uso nos testes
