// ── FONTES DE DADOS ───────────────────────────────────────────────────────────
// O seam de dados do dashboard: apiGet (wrapper de fetch), os dois adapters
// (FonteApi real e FonteSimulada) com a mesma interface { simulada, ultimos(),
// historico(pz, range) }, a variável `fonte` que aponta para a fonte ativa, e
// trocarFonte() — único ponto que troca a fonte e sincroniza a UI que depende disso.

// ── API (Cloudflare Worker + D1) ─────────────────────────────────────────────
// Wrapper simples de fetch com timeout, usado pelos dois endpoints abaixo.
async function apiGet(path) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(`${API_URL}${path}`, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  } finally { clearTimeout(timer); }
}

// Converte um array bruto de "pontos" (como devolvido por FonteApi/FonteSimulada.historico)
// no formato {label,value,time} que os gráficos/stats/tabela consomem, para um campo específico.
// Compartilhado pelos dois adapters — garante que real e simulado usem exatamente a mesma forma.
function pontosParaCampo(pontos, field) {
  // P5 — quando o campo é o nível d'água, propaga também o pico do intervalo (nivel_max),
  // devolvido pelo Worker em /dados junto da média — o pico nunca pode ficar escondido.
  const maxField = field === "nivel_agua" ? "nivel_max" : null;
  return (pontos || [])
    .filter(p => p[field] !== null && p[field] !== undefined && Number.isFinite(p[field]))
    .map(p => {
      const ms = p.ts * 1000;
      const out = {
        label: new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        value: parseFloat(Number(p[field]).toFixed(3)),
        time: ms,
      };
      if (maxField && Number.isFinite(p[maxField])) out.max = parseFloat(Number(p[maxField]).toFixed(3));
      return out;
    });
}

// ── SEAM: FONTE DE LEITURAS ──────────────────────────────────────────────────
// Todo o resto do dashboard (poll, loadHistoryAndStats, ...) só conhece a
// interface abaixo — { simulada, ultimos(), historico(pz, range) } — e nunca
// sabe se está falando com o Worker de verdade ou com o gerador simulado.
// Trocar a fonte ativa é só reatribuir a variável `fonte` (feito em trocarFonte()).

// Adapter real: fala com o Cloudflare Worker (+D1) via apiGet().
const FonteApi = {
  simulada: false,

  // Último valor de CADA piezômetro — GET /ultimos
  // Resposta: { "PZ-01": {nivel_agua,pressao,temperatura,ts,taxa_m_dia}, ... } (ts em segundos)
  async ultimos() {
    const json = await apiGet("/ultimos");
    const ids = Object.keys(json || {});
    if (!ids.length) throw new Error("Sem dados recentes");
    const result = {};
    ids.forEach(id => {
      const row = json[id] || {};
      result[id] = {
        nivel: row.nivel_agua, pressao: row.pressao, temperatura: row.temperatura,
        ts: row.ts, taxa_m_dia: Number.isFinite(row.taxa_m_dia) ? row.taxa_m_dia : null,
      };
    });
    return result;
  },

  // Histórico bruto (todos os campos) de um piezômetro/período — GET /dados?pz=&range=
  // Resposta: { pz, range, pontos: [{ts,nivel_agua,pressao,temperatura}, ...] } (ts em segundos, ordem cronológica)
  async historico(pz, range) {
    const json = await apiGet(`/dados?pz=${encodeURIComponent(pz)}&range=${encodeURIComponent(range)}`);
    return json.pontos || [];
  },
};

// ── SIMULAÇÃO ─────────────────────────────────────────────────────────────────
// Adapter simulado: mesma interface de FonteApi ({simulada, ultimos(), historico()}),
// usado quando a API real está indisponível. Cada piezômetro oscila de forma
// independente, para a visão geral e o mapa ficarem vivos na demonstração:
// PZ-01 ~10 m (faixa normal) · PZ-02 ~11,5 m (oscila até a faixa de atenção) · PZ-03 ~9 m (estável)
const FonteSimulada = {
  simulada: true,

  // Tabela ÚNICA de bases por piezômetro — usada tanto por ultimos() (drift ao vivo)
  // quanto por historico() (série simulada). Antes existiam duas tabelas divergentes
  // (10.2/11.5/9.0 aqui vs. 10/11.5/9 em loadHistoryAndStats); unificar elimina o
  // desalinhamento entre o "último valor" e o "histórico" mostrados na simulação.
  base: {
    "PZ-01": { n: 10.2, p: 1013, t: 24 },
    "PZ-02": { n: 11.5, p: 1013, t: 24 },
    "PZ-03": { n: 9.0,  p: 1013, t: 24 },
  },

  // Gera a leitura "ao vivo" de cada piezômetro (drift + ruído), avançando a base
  // um passo a cada chamada — é o antigo simTick(), agora chamado pelo poll normal
  // em vez de rodar num setInterval paralelo.
  async ultimos() {
    const b = this.base;
    b["PZ-01"].n = clamp(b["PZ-01"].n + (Math.random() - 0.48) * 0.25, 8.5, 13.5);
    b["PZ-02"].n = clamp(b["PZ-02"].n + (Math.random() - 0.5)  * 0.3,  10.5, 13.2);
    b["PZ-03"].n = clamp(b["PZ-03"].n + (Math.random() - 0.5)  * 0.15, 8.0, 10.2);

    const todos = {};
    Object.keys(b).forEach(pz => {
      const s = b[pz];
      const nAnterior = s.n;
      s.p = 1013.25 + (s.n - 10) * 10;  // coerente com a escala do firmware (10 hPa/m)
      s.t = clamp(s.t + (Math.random() - 0.5) * 0.3, 15, 40);
      // taxa_m_dia plausível: extrapola o drift do último passo do poll (CFG.poll ms) para m/dia,
      // mesma interface de FonteApi — nunca ligada de fato a um "dia" real na simulação.
      const deltaPoll = s.n - nAnterior;
      const taxa = parseFloat(((deltaPoll / (CFG.poll / 1000)) * 86400).toFixed(3));
      todos[pz] = {
        nivel: s.n, pressao: s.p, temperatura: s.t,
        ts: Math.floor(Date.now() / 1000), taxa_m_dia: taxa,
      };
    });
    return todos;
  },

  // Gera uma série histórica simulada coerente com a base do piezômetro/período pedidos
  // (mesma tabela `base` usada por ultimos() — ver comentário acima).
  async historico(pz, range) {
    const baseLevel = (this.base[pz] && this.base[pz].n) || 10;
    const fb = {
      "24h": { count: 48,  stepMs: 30 * 60 * 1000 },
      "7d":  { count: 84,  stepMs: 2  * 60 * 60 * 1000 },
      "30d": { count: 120, stepMs: 6  * 60 * 60 * 1000 },
    }[range] || { count: 48, stepMs: 30 * 60 * 1000 };
    const now = Date.now();
    const pontos = [];
    for (let i = fb.count; i >= 0; i--) {
      const time = now - i * fb.stepMs;
      const nivelAgua = parseFloat((baseLevel + (Math.random() - 0.5) * 1.6).toFixed(3));
      pontos.push({
        ts: Math.floor(time / 1000),
        nivel_agua: nivelAgua,
        // P5 — pico simulado do intervalo, sempre ≥ à média, para exercitar a série de máximo
        nivel_max: parseFloat((nivelAgua + Math.random() * 0.3).toFixed(3)),
        pressao: null,
        temperatura: parseFloat((22 + Math.random() * 8).toFixed(1)),
      });
    }
    return pontos;
  },
};

// Fonte de leituras ativa no momento — troca real↔simulação = trocar esta referência.
// Todo o resto do dashboard só enxerga a interface comum; ver seam acima (FonteApi/FonteSimulada).
let fonte = FonteApi;

// Único ponto que troca a fonte ativa e sincroniza a UI que depende disso
// (banner amarelo, espelho `simActive`). Absorve o antigo setSimMode().
function trocarFonte(novaFonte) {
  if (fonte === novaFonte) return;
  fonte = novaFonte;
  simActive = fonte.simulada;
  document.getElementById("sim-banner").classList.toggle("on", fonte.simulada);
}
