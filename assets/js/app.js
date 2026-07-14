// ── APP (ORQUESTRAÇÃO) ────────────────────────────────────────────────────────
// Seleção de piezômetro/período, carregamento de histórico, aplicação dos dados
// recebidos nos painéis, polling periódico da fonte ativa, relógio, inicialização
// dos controles de UI (howto, pills de período) e a IIFE de boot do dashboard.

// ── SELEÇÃO DE PIEZÔMETRO / PERÍODO ───────────────────────────────────────────
function resetPzState() {
  sparks.n = []; sparks.p = []; sparks.t = [];
  charts.n = { labels: [], data: [], times: [], maxData: [] };
  charts.t = { labels: [], data: [], times: [] };
  statsWin.n = []; statsWin.p = []; statsWin.t = []; statsWin.nMax = [];
  histPontos.n = [];
  histPontos.bucketSeg = undefined;
  readingsHistory = [];
  lastLevel = null;
  lastTaxaRapidaState = false;
  ["n", "p", "t"].forEach(k => {
    const mn = document.getElementById(k + "-min"), mx = document.getElementById(k + "-max");
    const dl = document.getElementById(k + "-delta");
    if (mn) mn.textContent = "—";
    if (mx) mx.textContent = "—";
    if (dl) { dl.textContent = "—"; dl.className = "mstat-val"; }
  });
  renderTaxa(null); // P3 — limpa o stat TAXA ao trocar de pz/período
  renderReadingsTable();
  redrawCharts();
}

function selectPiezometro(id) {
  if (!PIEZOMETROS.some(p => p.id === id) || id === pzSelecionado) return;
  pzSelecionado = id;
  resetPzState();
  updatePzLabels();
  atualizarVisaoGeral(pzLatest);
  atualizarMapa(pzLatest);
  loadHistoryAndStats();
  if (pzLatest[id]) applyData(pzLatest[id]);
}

function selectPeriodo(p) {
  if (!PERIODOS[p] || p === periodoSelecionado) return;
  periodoSelecionado = p;
  document.querySelectorAll(".period-pill").forEach(btn => btn.classList.toggle("active", btn.dataset.range === p));
  updatePeriodLabels();
  resetPzState();
  loadHistoryAndStats();
}

// Carrega histórico do piezômetro/período selecionados (nível + temperatura),
// semeia stats, tabela de leituras e redesenha os gráficos.
// Consome só `fonte.historico()` — não sabe (nem precisa saber) se é real ou simulada.
async function loadHistoryAndStats() {
  // P — token desta chamada: se pzSelecionado/periodoSelecionado mudar de novo antes de
  // terminarmos, histReqId avança e nós descartamos nosso resultado silenciosamente (ver
  // checagens após cada await abaixo) em vez de sobrescrever a seleção atual com dados velhos.
  const meuId = ++histReqId;
  let pontos, bucketSeg, viaFallbackLocal = false;
  try {
    ({ pontos, bucket_seg: bucketSeg } = await fonte.historico(pzSelecionado, periodoSelecionado));
  } catch (e) {
    if (meuId !== histReqId) return; // seleção mudou enquanto a 1ª chamada estava em voo
    // Fallback só para ESTE carregamento (não mexe na fonte global nem no banner —
    // isso é responsabilidade exclusiva de trocarFonte(), acionada pelo poll).
    ({ pontos, bucket_seg: bucketSeg } = await FonteSimulada.historico(pzSelecionado, periodoSelecionado));
    viaFallbackLocal = true;
  }
  if (meuId !== histReqId) return; // seleção mudou enquanto o histórico estava em voo

  const hn = pontosParaCampo(pontos, "nivel_agua");
  const ht = pontosParaCampo(pontos, "temperatura");

  if (hn.length) {
    charts.n.labels  = hn.map(h => h.label);
    charts.n.data    = hn.map(h => h.value);
    charts.n.times   = hn.map(h => h.time);
    // P5 — série do pico do intervalo (cai para o próprio valor quando o Worker não manda nivel_max)
    charts.n.maxData = hn.map(h => Number.isFinite(h.max) ? h.max : h.value);
    statsWin.n       = hn.map(h => h.value);
    statsWin.nMax    = charts.n.maxData.slice();
    // Série completa do período, com timestamps — não é truncada pelas 60 posições dos
    // gráficos, ao contrário de charts.n (ver comentário de histPontos em estado.js).
    // minValue/nLeituras (P5/auditoria) ficam `undefined` quando o Worker não trouxe
    // nivel_min/n_leituras (dados antigos) — exportar.js trata isso sem quebrar.
    histPontos.n     = hn.map(h => ({
      label: h.label, value: h.value,
      maxValue: Number.isFinite(h.max) ? h.max : h.value,
      minValue: h.min, nLeituras: h.n,
      time: h.time,
    }));
    // bucket_seg do período carregado (segundos) — guardado para os metadados do CSV
    // exportado (exportar.js); ausente ("ao vivo") quando a fonte não o informou.
    histPontos.bucketSeg = bucketSeg;
    updateStats("n", statsWin.n);
    aplicarMaxNivelPico(); // P5 — MÁX 24H usa o pico do intervalo, não a média
    readingsHistory = hn.slice(-12).reverse().map(h => {
      const cls = classifyNivel(h.value);
      return { time: h.label, nivel: h.value, lv: cls.lv, lbl: cls.lbl };
    });
    renderReadingsTable();
    if (!viaFallbackLocal) addInfoRow(`Histórico de nível d'água carregado (${hn.length} pontos) — ${pzSelecionado}`);
  }
  if (ht.length) {
    charts.t.labels = ht.map(h => h.label);
    charts.t.data   = ht.map(h => h.value);
    charts.t.times  = ht.map(h => h.time);
    statsWin.t      = ht.map(h => h.value);
    updateStats("t", statsWin.t);
    if (!viaFallbackLocal) addInfoRow(`Histórico de temperatura carregado (${ht.length} pontos) — ${pzSelecionado}`);
  }
  if (viaFallbackLocal) {
    addInfoRow(`Histórico da API indisponível — exibindo histórico simulado (${pzSelecionado})`);
  }

  redrawCharts();
}

// ── APLICA DADOS DO PIEZÔMETRO SELECIONADO ───────────────────────────────────
function applyData({ nivel, pressao, temperatura, taxa_m_dia, ts, recebidoEm }) {
  const safe = (v, d) => (typeof v === "number" && isFinite(v) ? v : d);
  nivel       = safe(nivel, 10);      // 1013 hPa no Wokwi ↔ 10 m simulados
  pressao     = safe(pressao, 1013);
  temperatura = safe(temperatura, 24);

  const flash = id => {
    const el = document.getElementById(id);
    el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
  };

  document.getElementById("val-n").textContent = nivel.toFixed(2);       flash("val-n");
  document.getElementById("val-p").textContent = pressao.toFixed(1);     flash("val-p");
  document.getElementById("val-t").textContent = temperatura.toFixed(1); flash("val-t");

  // Sparklines
  pushSpark("n", nivel);
  pushSpark("p", pressao);
  pushSpark("t", temperatura);

  // Charts
  const lbl = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const iso = new Date().toISOString();
  pushChart("n", lbl, nivel, iso);
  pushChart("t", lbl, temperatura, iso);
  redrawCharts();

  // Stats (janela completa do período, não só os pontos visíveis no gráfico)
  pushStats("n", nivel);
  pushStats("nMax", nivel); // leitura ao vivo é instantânea: o valor também é o pico do instante
  pushStats("p", pressao);
  pushStats("t", temperatura);
  updateStats("n", statsWin.n);
  updateStats("p", statsWin.p);
  updateStats("t", statsWin.t);
  aplicarMaxNivelPico(); // P5 — MÁX 24H usa o pico do intervalo, não a média

  // Badge dinâmico de temperatura
  const bt = document.getElementById("badge-t");
  if (temperatura >= 0 && temperatura <= 50) { bt.className = "mbadge mb-blue";   bt.textContent = "Normal"; }
  else                                        { bt.className = "mbadge mb-yellow"; bt.textContent = "Verificar"; }

  // P3 — taxa de variação (display), independente do estado de comunicação
  renderTaxa(taxa_m_dia);

  // P3+P4 — alarme de variação rápida, edge-triggered (só na transição parado→rápido),
  // só com comunicação ok (dado stale não confirma tendência real)
  const taxaRapidaAgora = Number.isFinite(taxa_m_dia) && Math.abs(taxa_m_dia) > CFG.taxaMaxMDia;
  if (estadoComunicacao({ ts, recebidoEm }) === "ok") {
    if (taxaRapidaAgora && !lastTaxaRapidaState) addTaxaRow(taxa_m_dia);
    lastTaxaRapidaState = taxaRapidaAgora;
  }

  // P1 — dado stale nunca é avaliado como normal: alarme de nível fica suspenso,
  // o painel mostra o estado neutro "SEM SINAL" e a leitura VELHA não é
  // re-registrada na tabela como se fosse nova (seria enganoso).
  if (estadoComunicacao({ ts, recebidoEm }) === "stale") {
    setAlertSemSinal(ts);
  } else {
    pushReading(nivel); // tabela de últimas leituras — só com dado fresco
    setAlert(nivel);
  }
}

// ── RELÓGIO ───────────────────────────────────────────────────────────────────
function updateClock() {
  const n = new Date();
  const dd = String(n.getDate()).padStart(2, "0");
  const mm = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][n.getMonth()];
  const hh = String(n.getHours()).padStart(2, "0");
  const mi = String(n.getMinutes()).padStart(2, "0");
  const ss = String(n.getSeconds()).padStart(2, "0");
  document.getElementById("live-time").textContent = `Ao vivo · ${dd} ${mm} ${n.getFullYear()} ${hh}:${mi}:${ss}`;
}

// ── COMO LER ESTE PAINEL (recolhível) ────────────────────────────────────────
function initHowto() {
  const btn = document.getElementById("howto-toggle");
  const content = document.getElementById("howto-content");
  if (!btn || !content) return;
  btn.addEventListener("click", () => {
    const open = content.classList.toggle("open");
    btn.textContent = open ? "❓ Ocultar explicação" : "❓ Como ler este painel";
  });
}

function initPeriodPills() {
  document.querySelectorAll(".period-pill").forEach(btn => {
    btn.addEventListener("click", () => selectPeriodo(btn.dataset.range));
  });
}

// ── POLLING ───────────────────────────────────────────────────────────────────
// Roda a cada CFG.poll (10s), sempre — não existe mais um setInterval paralelo
// para a simulação. Quando `fonte` é a simulada, fonte.ultimos() devolve os
// valores gerados e o poll não percebe diferença nenhuma.
async function poll() {
  try {
    const dadosTodos = await fonte.ultimos();
    pzLatest = dadosTodos;

    if (fonte.simulada) {
      // Enquanto em modo simulado, tenta também um ping barato à API real para
      // detectar quando ela volta e trocar de fonte automaticamente.
      try {
        pzLatest = await FonteApi.ultimos();
        trocarFonte(FonteApi);
        failCount = 0;
        setStatus("live", `API conectada — atualizado às ${new Date().toLocaleTimeString("pt-BR")}`);
      } catch (_) {
        setStatus("sim", "Modo simulação ativo — API indisponível");
      }
    } else {
      failCount = 0;
      setStatus("live", `API conectada — atualizado às ${new Date().toLocaleTimeString("pt-BR")}`);
    }

    checarTransicoesComunicacao(pzLatest); // P1 — eventos de ok↔stale de todos os pz
    atualizarVisaoGeral(pzLatest);
    atualizarMapa(pzLatest);
    const sel = pzLatest[pzSelecionado];
    if (!sel || !Number.isFinite(sel.nivel)) throw new Error(`Sem dados recentes para ${pzSelecionado}`);
    applyData(sel);
  } catch (e) {
    failCount++;
    console.warn("Fonte de leituras:", e.message);
    if (failCount === 1) {
      setStatus("err", `Falha na API: ${e.message}`);
      addInfoRow("Erro ao conectar na API — ativando simulação");
    }
    if (failCount >= 2 && !fonte.simulada) {
      trocarFonte(FonteSimulada);
      setStatus("sim", "Modo simulação ativo — API indisponível");
    }
  }
}

// ── INIT ──────────────────────────────────────────────────────────────────────
(async function init() {
  updateClock();
  setInterval(updateClock, 1000);

  // Antes de montar mapa/grid e iniciar o polling: tenta carregar config do servidor
  await loadConfig();

  initHowto();
  initPeriodPills();
  updatePeriodLabels();
  updatePzLabels();
  initMap();

  const exportBtn = document.getElementById("btn-export");
  if (exportBtn) exportBtn.addEventListener("click", exportCSV);

  const exportXlsBtn = document.getElementById("btn-export-xls");
  if (exportXlsBtn) exportXlsBtn.addEventListener("click", exportXLS);

  atualizarVisaoGeral(pzLatest);
  atualizarMapa(pzLatest);

  // Carrega histórico do período/piezômetro selecionados
  await loadHistoryAndStats();

  window.addEventListener("resize", () => {
    redrawCharts();
    if (leafletMap) leafletMap.invalidateSize();
  });

  await poll();
  setInterval(poll, CFG.poll);

  // Navegadores estrangulam (ou pausam) o setInterval de poll() em abas em background —
  // ao voltar, o operador poderia olhar por até um ciclo inteiro (CFG.poll) para um dado
  // que já está velho sem perceber. Ao readquirir visibilidade, força um poll() imediato.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") poll();
  });
})();
