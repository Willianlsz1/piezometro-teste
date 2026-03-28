const http  = require("http");
const https = require("https");
const fs    = require("fs");
const path  = require("path");

try { require("dotenv").config(); } catch { /* dotenv opcional em produção */ }

// ── CONFIG ────────────────────────────────────────────────────────────────────
const PORT           = process.env.PORT           || 3000;
const INFLUX_URL     = process.env.INFLUX_URL     || "https://us-east-1-1.aws.cloud2.influxdata.com";
const INFLUX_TOKEN   = process.env.INFLUX_TOKEN   || "";
const INFLUX_ORG     = process.env.INFLUX_ORG     || "SAMARCO";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

if (!INFLUX_TOKEN) {
  // log ainda não está definido aqui, usamos console.error diretamente
  console.error("[ERROR] INFLUX_TOKEN não definido. Defina no arquivo .env ou nas variáveis de ambiente.");
  process.exit(1);
}

const MAX_BODY_BYTES = 8 * 1024;

// ── RATE LIMITING ─────────────────────────────────────────────────────────────
// Janela deslizante: máximo de MAX_REQ_PER_WINDOW requisições por IP
// dentro de RATE_WINDOW_MS milissegundos.
const RATE_WINDOW_MS     = 1000;  // janela de 1 segundo
const MAX_REQ_PER_WINDOW = 10;    // máximo 10 req/s por IP

/** @type {Map<string, {count: number, windowStart: number}>} */
const rateLimitMap = new Map();

/**
 * Verifica se o IP informado está dentro do limite de requisições permitido.
 * Usa janela deslizante de 1 segundo com reset automático.
 * @param {string} ip - Endereço IP do cliente
 * @returns {boolean} true se a requisição deve ser permitida, false se bloqueada
 */
function checkRateLimit(ip) {
  const now   = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return true;
  }

  entry.count++;
  return entry.count <= MAX_REQ_PER_WINDOW;
}

// Limpa entradas antigas do rate limit a cada 60 s para evitar memory leak
setInterval(() => {
  const cutoff = Date.now() - RATE_WINDOW_MS * 60;
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (entry.windowStart < cutoff) rateLimitMap.delete(ip);
  }
}, 60_000);

// ── MÉTRICAS ──────────────────────────────────────────────────────────────────
const metrics = {
  startTime:     new Date().toISOString(),
  totalRequests: 0,
  blockedByRate: 0,
  queryCount:    0,
  lastReading:   null,  // { ts, bodySize, ip }
};

// ── LOGGING ESTRUTURADO ───────────────────────────────────────────────────────
/**
 * Emite uma linha de log estruturado com timestamp ISO, nível e contexto JSON.
 * Formato: [2026-03-28T12:00:00.000Z] [INFO ] mensagem {"chave":"valor"}
 * @param {"INFO"|"WARN"|"ERROR"} level - Nível de severidade
 * @param {string} message - Mensagem principal
 * @param {object} [ctx={}] - Contexto adicional serializado como JSON
 */
function log(level, message, ctx = {}) {
  const ts    = new Date().toISOString();
  const extra = Object.keys(ctx).length ? " " + JSON.stringify(ctx) : "";
  const line  = `[${ts}] [${level.padEnd(5)}] ${message}${extra}`;
  if (level === "ERROR") console.error(line);
  else console.log(line);
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function sendJSON(res, status, obj) {
  res.writeHead(status, {
    "Content-Type":                "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  });
  res.end(JSON.stringify(obj));
}

function setCORSHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin",  ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age",       "86400");
  res.setHeader("Vary",                         "Origin");
}

function getClientIP(req) {
  return (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown")
    .split(",")[0].trim();
}

// ── PROXY INFLUXDB ────────────────────────────────────────────────────────────
function proxyToInflux(flux, res, meta) {
  const url  = new URL(`${INFLUX_URL}/api/v2/query?org=${encodeURIComponent(INFLUX_ORG)}`);
  const body = Buffer.from(flux, "utf8");

  const req = https.request(
    {
      hostname: url.hostname,
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
      log("INFO", "InfluxDB respondeu", { status: influxRes.statusCode, ip: meta.ip });
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
    log("ERROR", "Proxy InfluxDB error", { message: e.message, ip: meta.ip });
    res.writeHead(502, {
      "Content-Type":                "application/json",
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    });
    res.end(JSON.stringify({ error: e.message }));
  });

  req.write(body);
  req.end();
}

// ── SERVIDOR ──────────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const ip  = getClientIP(req);
  const url = new URL(req.url, `http://localhost`);
  const t0  = Date.now();

  setCORSHeaders(res);
  metrics.totalRequests++;

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

  // ── /query → proxy para InfluxDB ──────────────────────────────────────────
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

      metrics.queryCount++;
      metrics.lastReading = { ts: new Date().toISOString(), bodySize: bytes, ip };

      log("INFO", "Query encaminhada ao InfluxDB", { ip, bytes, ms: Date.now() - t0 });
      proxyToInflux(body, res, { ip });
    });

    return;
  }

  // ── /health → status do serviço ───────────────────────────────────────────
  if (req.method === "GET" && url.pathname === "/health") {
    return sendJSON(res, 200, {
      status:  "ok",
      ts:      new Date().toISOString(),
      influx:  INFLUX_URL,
      uptime:  process.uptime(),
    });
  }

  // ── /metrics → métricas operacionais do serviço ───────────────────────────
  if (req.method === "GET" && url.pathname === "/metrics") {
    return sendJSON(res, 200, {
      startTime:     metrics.startTime,
      uptime:        process.uptime(),
      totalRequests: metrics.totalRequests,
      blockedByRate: metrics.blockedByRate,
      queryCount:    metrics.queryCount,
      lastReading:   metrics.lastReading,
    });
  }

  // ── / → serve o dashboard HTML ────────────────────────────────────────────
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
  log("INFO", `${signal} recebido — encerrando servidor...`);
  server.close(() => {
    log("INFO", "Servidor encerrado com sucesso.");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

// ── START ─────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  log("INFO", "Piezômetro proxy iniciado",          { port: PORT });
  log("INFO", `Dashboard: http://0.0.0.0:${PORT}/`);
  log("INFO", `Health:    http://0.0.0.0:${PORT}/health`);
  log("INFO", `Metrics:   http://0.0.0.0:${PORT}/metrics`);
  log("INFO", `Proxy:     http://0.0.0.0:${PORT}/query`);
});

module.exports = { server, metrics, checkRateLimit }; // Exportado para uso nos testes
