const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

// ── CONFIG ────────────────────────────────────────────────────────────────────
const PORT         = process.env.PORT || 3000;
const INFLUX_URL   = "https://us-east-1-1.aws.cloud2.influxdata.com";
const INFLUX_TOKEN = "dNPdQWtPzpKTXumx2f-RKYS-b7XpBI8EWW_0OKnUmP_gy1v5sh_2uVGnFFFXH8ht6IgYOCp4FcB8MpZAvshHtw==";
const INFLUX_ORG   = "SAMARCO";

// ── HELPERS ───────────────────────────────────────────────────────────────────
function corsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function proxyToInflux(flux, res) {
  const url  = new URL(`${INFLUX_URL}/api/v2/query?org=${encodeURIComponent(INFLUX_ORG)}`);
  const body = Buffer.from(flux, "utf8");

  const req = https.request({
    hostname: url.hostname,
    path:     url.pathname + url.search,
    method:   "POST",
    headers: {
      "Authorization": `Token ${INFLUX_TOKEN}`,
      "Content-Type":  "application/vnd.flux",
      "Accept":        "application/csv",
      "Content-Length": body.length,
    }
  }, (influxRes) => {
    res.writeHead(influxRes.statusCode, {
      "Content-Type": "application/csv",
      "Access-Control-Allow-Origin": "*",
    });
    influxRes.pipe(res);
  });

  req.on("error", (e) => {
    res.writeHead(502);
    res.end(JSON.stringify({ error: e.message }));
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
    req.on("data", d => body += d);
    req.on("end", () => proxyToInflux(body, res));
    return;
  }

  // ── /health  →  status
  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "ok", ts: new Date().toISOString() }));
  }

  // ── /  →  serve o dashboard HTML
  if (url.pathname === "/" || url.pathname === "/index.html") {
    const file = path.join(__dirname, "public", "index.html");
    if (fs.existsSync(file)) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return fs.createReadStream(file).pipe(res);
    }
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`✅ Piezômetro proxy rodando em http://0.0.0.0:${PORT}`);
  console.log(`   → Dashboard:  http://0.0.0.0:${PORT}/`);
  console.log(`   → Health:     http://0.0.0.0:${PORT}/health`);
  console.log(`   → Proxy:      http://0.0.0.0:${PORT}/query`);
});
