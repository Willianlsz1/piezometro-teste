/**
 * Testes automatizados do servidor proxy piezômetro
 * Execução: node test.js
 * Requer Node.js 18+ (usa o módulo node:test nativo, sem dependências externas)
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http   = require("node:http");

// Define variáveis de ambiente ANTES de importar o servidor
process.env.INFLUX_TOKEN = "test-token-fake-para-testes";
process.env.PORT         = "0"; // Porta 0 = o SO aloca uma porta livre automaticamente

// Importa o servidor DEPOIS de definir as env vars
const { server, metrics, checkRateLimit } = require("./server.js");

// ─── UTILITÁRIOS DE TESTE ────────────────────────────────────────────────────

/** Aguarda o servidor iniciar e retorna a porta alocada pelo SO */
function getPort() {
  return new Promise((resolve) => {
    if (server.listening) return resolve(server.address().port);
    server.once("listening", () => resolve(server.address().port));
  });
}

/**
 * Faz uma requisição HTTP ao servidor local e retorna status + body.
 * @param {number} port - Porta do servidor
 * @param {string} method - Método HTTP
 * @param {string} path - Caminho da requisição
 * @param {string|null} body - Corpo da requisição (opcional)
 * @param {object} headers - Cabeçalhos adicionais
 */
function request(port, method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: "127.0.0.1",
      port,
      method,
      path,
      headers: { "Content-Type": "application/json", ...headers },
    };
    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, body: parsed, headers: res.headers });
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

let PORT;

before(async () => {
  PORT = await getPort();
});

after(() => {
  server.close();
});

// ─── TESTES /health ──────────────────────────────────────────────────────────

test("GET /health retorna 200 com status ok", async () => {
  const res = await request(PORT, "GET", "/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "ok");
  assert.ok(res.body.ts,     "deve ter campo ts (timestamp)");
  assert.ok(res.body.uptime >= 0, "deve ter campo uptime numérico");
  assert.ok(res.body.influx, "deve ter campo influx (URL do cluster)");
});

test("GET /health retorna Content-Type application/json", async () => {
  const res = await request(PORT, "GET", "/health");
  assert.ok(res.headers["content-type"].includes("application/json"),
    `Content-Type esperado: application/json, recebido: ${res.headers["content-type"]}`);
});

// ─── TESTES /metrics ─────────────────────────────────────────────────────────

test("GET /metrics retorna 200 com todos os campos obrigatórios", async () => {
  const res = await request(PORT, "GET", "/metrics");
  assert.equal(res.status, 200);
  assert.ok(typeof res.body.totalRequests === "number", "deve ter totalRequests numérico");
  assert.ok(typeof res.body.queryCount    === "number", "deve ter queryCount numérico");
  assert.ok(typeof res.body.blockedByRate === "number", "deve ter blockedByRate numérico");
  assert.ok(typeof res.body.uptime        === "number", "deve ter uptime numérico");
  assert.ok("startTime"   in res.body,                 "deve ter startTime");
  assert.ok("lastReading" in res.body,                 "deve ter lastReading (pode ser null)");
});

test("GET /metrics incrementa totalRequests a cada requisição", async () => {
  const before = (await request(PORT, "GET", "/metrics")).body.totalRequests;
  await request(PORT, "GET", "/metrics");
  const after  = (await request(PORT, "GET", "/metrics")).body.totalRequests;
  assert.ok(after > before,
    `totalRequests deve crescer: antes=${before}, depois=${after}`);
});

// ─── TESTES /query (validação de input) ──────────────────────────────────────

test("POST /query sem body retorna 400 com campo error", async () => {
  const res = await request(PORT, "POST", "/query", "", {
    "Content-Type": "application/vnd.flux",
  });
  assert.equal(res.status, 400);
  assert.ok(res.body.error, "deve ter campo error na resposta");
});

test("POST /query com body maior que 8 KB retorna 413 ou destrói conexão", async () => {
  const bigBody = "x".repeat(9 * 1024); // 9 KB > limite de 8 KB
  let status;
  try {
    const res = await request(PORT, "POST", "/query", bigBody, {
      "Content-Type": "application/vnd.flux",
    });
    status = res.status;
  } catch {
    // Conexão destruída pelo servidor = comportamento esperado para payload grande
    status = 0;
  }
  assert.ok(status === 413 || status === 0,
    `Esperado 413 ou conexão destruída (0), recebido: ${status}`);
});

// ─── TESTES RATE LIMITING ─────────────────────────────────────────────────────

test("checkRateLimit permite exatamente 10 requisições dentro da janela", () => {
  const testIP = "10.99.1.1"; // IP isolado para não interferir com outros testes
  let permitidas = 0;
  for (let i = 0; i < 10; i++) {
    if (checkRateLimit(testIP)) permitidas++;
  }
  assert.equal(permitidas, 10, "Exatamente 10 requisições devem ser permitidas");
});

test("checkRateLimit bloqueia a 11ª requisição no mesmo segundo", () => {
  const testIP = "10.99.1.2"; // IP isolado
  for (let i = 0; i < 10; i++) checkRateLimit(testIP); // Esgota o limite
  const resultado = checkRateLimit(testIP);
  assert.equal(resultado, false, "A 11ª requisição deve ser bloqueada (false)");
});

test("POST /query com IP fixo excedendo limite retorna 429", async () => {
  // Envia 15 requisições com o mesmo IP via x-forwarded-for
  const reqs = Array.from({ length: 15 }, () =>
    request(PORT, "POST", "/query", "from(bucket:\"x\") |> range(start: -1m)", {
      "Content-Type":    "application/vnd.flux",
      "x-forwarded-for": "10.99.2.1",
    })
  );
  const respostas = await Promise.all(reqs);
  const bloqueadas = respostas.filter((r) => r.status === 429);
  assert.ok(
    bloqueadas.length >= 1,
    `Deve haver pelo menos 1 resposta 429, obteve ${bloqueadas.length} de ${respostas.length}`
  );
});

// ─── TESTES CORS ─────────────────────────────────────────────────────────────

test("OPTIONS /query retorna 204 com header Access-Control-Allow-Origin", async () => {
  const res = await request(PORT, "OPTIONS", "/query");
  assert.equal(res.status, 204);
  assert.ok(
    res.headers["access-control-allow-origin"],
    "Deve ter header Access-Control-Allow-Origin na resposta preflight"
  );
});

// ─── TESTES 404 ──────────────────────────────────────────────────────────────

test("GET /rota-inexistente retorna 404", async () => {
  const res = await request(PORT, "GET", "/rota-que-nao-existe");
  assert.equal(res.status, 404);
});
