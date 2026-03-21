const http  = require("http");
const https = require("https");
const fs    = require("fs");
const path  = require("path");

// ── CORREÇÃO #1: Carregar variáveis de ambiente via .env (se existir) ─────────
// O token NUNCA deve ficar hardcoded no código. Use um arquivo .env local
// (nunca commitado) ou variáveis de ambiente do servidor (Railway, etc.).
try { require("dotenv").config(); } catch { /* dotenv opcional em produção */ }

// ── CONFIG ────────────────────────────────────────────────────────────────────
const PORT         = process.env.PORT         || 3000;
const INFLUX_URL   = process.env.INFLUX_URL   || "https://us-east-1-1.aws.cloud2.influxdata.com";
const INFLUX_TOKEN = process.env.INFLUX_TOKEN || "";   // CORREÇÃO #1: sem fallback hardcoded
const INFLUX_ORG   = process.env.INFLUX_ORG   || "SAMARCO";

// Falha rápida: impede subir o servidor sem token configurado
if (!INFLUX_TOKEN) {
  console.error("❌  INFLUX_TOKEN não definido. Defina no arquivo .env ou nas variáveis de ambiente.");
  process.exit(1);
}

// ── CORREÇÃO #2: Limite de tamanho do body (proteção contra DoS) ──────────────
const MAX_BODY_BYTES = 8 * 1024; // 8 KB — queries Flux legítimas são muito menores

// ── CORREÇÃO #3: CORS restrito por origem ─────────────────────────────────────
// Em produção, troque "*" pelo domínio real: ex: "https://meu-app.railway.app"
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

function corsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin",  ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Vary", "Origin");
}
  // CORREÇÃO #3b: Não expor Authorization no CORS — o token fica só no servidor
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function sendJSON(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

// ── PROXY INFLUXDB ────────────────────────────────────────────────────────────
function proxyToInflux(flux, res) {
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
      // CORS em todas as respostas do proxy
      res.writeHead(influxRes.statusCode, {
        "Content-Type":                  "application/csv",
        "Access-Control-Allow-Origin":   ALLOWED_ORIGIN,
        "Access-Control-Allow-Methods":  "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers":  "Content-Type",
        "Vary":                          "Origin",
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
      "Content-Type":                 "application/json",
      "Access-Control-Allow-Origin":  ALLOWED_ORIGIN,
    });
    res.end(JSON.stringify({ error: e.message }));
  });

  req.write(body);
  req.end();
}
  // CORREÇÃO #4: Timeout de 15s para não travar requisições penduradas
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
      res.writeHead(influxRes.statusCode, {
        "Content-Type":                 "application/csv",
        "Access-Control-Allow-Origin":  ALLOWED_ORIGIN,
      });
      influxRes.pipe(res);
    }
  );

  // CORREÇÃO #4b: Tratar evento de timeout separadamente
  req.on("timeout", () => {
    req.destroy(new Error("Timeout ao conectar no InfluxDB (15s)"));
  });

  req.on("error", (e) => {
    console.error("Proxy InfluxDB error:", e.message);
    // CORREÇÃO: Content-Type correto na resposta de erro
    sendJSON(res, 502, { error: e.message });
  });

  req.write(body);
  req.end();
}

// ── SERVIDOR ──────────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  corsHeaders(res);

  // Preflight CORS
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  const url = new URL(req.url, `http://localhost`);

  // ── /query  →  proxy para InfluxDB
  if (req.method === "POST" && url.pathname === "/query") {
    let body = "";
    let bytes = 0;

    req.on("data", (chunk) => {
      bytes += chunk.length;
      // CORREÇÃO #2: Rejeita body maior que o limite
      if (bytes > MAX_BODY_BYTES) {
        req.destroy();
        return sendJSON(res, 413, { error: "Payload muito grande" });
      }
      body += chunk;
    });

    req.on("end", () => {
      if (!body.trim()) return sendJSON(res, 400, { error: "Body vazio" });
      proxyToInflux(body, res);
    });

    return;
  }

  // ── /health  →  status
  if (url.pathname === "/health") {
    return sendJSON(res, 200, {
      status: "ok",
      ts:     new Date().toISOString(),
      influx: INFLUX_URL,
    });
  }

  // ── / → serve o dashboard HTML
  // CORREÇÃO #5: O arquivo index.html está na raiz do projeto, não em /public/
  if (url.pathname === "/" || url.pathname === "/index.html") {
    const file = path.join(__dirname, "index.html");   // ← era "public", "index.html"
    if (fs.existsSync(file)) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return fs.createReadStream(file).pipe(res);
    }
  }

  sendJSON(res, 404, { error: "Not found" });
});

// ── CORREÇÃO #6: Graceful shutdown ───────────────────────────────────────────
function shutdown(signal) {
  console.log(`\n⚠️  ${signal} recebido — encerrando servidor...`);
  server.close(() => {
    console.log("✅ Servidor encerrado com sucesso.");
    process.exit(0);
  });
  // Força saída após 5s se ainda houver conexões abertas
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
});
