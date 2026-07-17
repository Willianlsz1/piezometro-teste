// ── ALERTA À POPULAÇÃO ───────────────────────────────────────────────────────
// Simula, no celular de cada espectador, o alerta que a Defesa Civil dispararia
// na ZAS (Zona de Autossalvamento) se a barragem real cruzasse o limiar crítico.
// Reaproveita CFG/loadConfig() (config.js) e classifyNivel()/estadoComunicacao()
// (util.js); aqui só o específico da página: estados, áudio, vibração, wake
// lock, ZAS e poll de /ultimos. Estados: aguardando → normal|atencao|critico|
// semsinal, com "normalizado" (poucos segundos) só ao sair do crítico pro normal.

// ── CONSTANTES ────────────────────────────────────────────────────────────────
const ZAS_RAIO_KM = 10; // raio real da legislação — só define a frase exibida
// Modo demo (padrão, sem ?demo=0): a "barragem" fica ~0,02° ao norte de quem
// ativou (≈2,2 km — 1° lat ≈ 111 km), pra qualquer plateia cair dentro da ZAS.
const DEMO_DESLOCAMENTO_LAT = 0.02;
// Fallback de ?demo=0 se PIEZOMETROS[0] vier sem lat/lng (Germano/Mariana-MG)
const BARRAGEM_REAL_FALLBACK = { lat: -20.1975, lng: -43.4653 };

// ── ESTADO DO MÓDULO ─────────────────────────────────────────────────────────
let pzId = "PZ-01", estadoAtual = "aguardando", transicaoTimer = null, pollTimer = null;
let emVoo = false, falhasSeguidas = 0; // emVoo = trava de poll reentrante (P1, mesmo princípio do dashboard)
let audioCtx = null, sireneOsc = null, sireneGain = null, sireneVarredura = null;
let vibraInterval = null, wakeLock = null;
let zasTexto = "", zasDisponivel = false, zasDistanciaKm = null, modoDemo = true;
let ativado = false; // true assim que o botão ATIVAR é tocado (distinto do tela "aguardando")
// loadConfig() (config.js) referencia `pzSelecionado` global quando /config devolve
// piezômetros — variável que só existe no dashboard completo (estado.js). Sem declará-la
// aqui, vira ReferenceError (cai no catch só DEPOIS de já ter sobrescrito PIEZOMETROS).
let pzSelecionado = null;

// ── HAVERSINE (distância entre duas coordenadas, em km) ─────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── FETCH ────────────────────────────────────────────────────────────────────
// Wrapper local (sem carregar fontes.js inteiro) — também serve de apiGet()
// global pro loadConfig() de config.js, reaproveitando-o em vez de duplicá-lo.
async function apiGet(path, timeoutMs = 8000) {
  const r = await fetch(`${API_URL}${path}`, { signal: AbortSignal.timeout(timeoutMs) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// ── ÁUDIO (WebAudio) ─────────────────────────────────────────────────────────
// AudioContext nasce no clique de ATIVAR (autoplay policy exige gesto do usuário)
function tocarTom(freq, duracaoSeg, atrasoSeg) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.value = 0.4;
  osc.connect(gain).connect(audioCtx.destination);
  const t0 = audioCtx.currentTime + atrasoSeg;
  osc.start(t0);
  osc.stop(t0 + duracaoSeg);
}

// Beep de atenção: 2 tons curtos (não é a sirene contínua do crítico)
function beepAtencao() {
  tocarTom(880, 0.12, 0);
  tocarTom(880, 0.12, 0.22);
}

// Sirene do crítico: oscillator varrendo ~600→1200→600 Hz em ~1s, em loop.
function iniciarSirene() {
  if (!audioCtx || sireneOsc) return; // sem áudio (bloqueado) ou já tocando
  sireneOsc = audioCtx.createOscillator();
  sireneGain = audioCtx.createGain();
  sireneOsc.type = "sine";
  sireneGain.gain.value = 0.5;
  sireneOsc.connect(sireneGain).connect(audioCtx.destination);
  sireneOsc.start();
  const inicio = audioCtx.currentTime;
  sireneVarredura = setInterval(() => {
    if (!audioCtx || !sireneOsc) return;
    const t = (audioCtx.currentTime - inicio) % 1; // período de 1s
    const freq = t < 0.5 ? 600 + t * 2 * 600 : 1200 - (t - 0.5) * 2 * 600;
    sireneOsc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  }, 30);
}
function pararSirene() {
  if (sireneVarredura) { clearInterval(sireneVarredura); sireneVarredura = null; }
  if (sireneOsc) { try { sireneOsc.stop(); } catch (e) { /* já parado */ } sireneOsc.disconnect(); sireneOsc = null; }
  if (sireneGain) { sireneGain.disconnect(); sireneGain = null; }
}

// ── VIBRAÇÃO ─────────────────────────────────────────────────────────────────
// iOS não tem navigator.vibrate — degrada em silêncio (o vermelho continua)
function iniciarVibracao() {
  if (!navigator.vibrate) return;
  const padrao = [800, 200, 800, 200];
  navigator.vibrate(padrao);
  vibraInterval = setInterval(() => navigator.vibrate(padrao), 2200);
}
function pararVibracao() {
  if (vibraInterval) { clearInterval(vibraInterval); vibraInterval = null; }
  if (navigator.vibrate) navigator.vibrate(0);
}

// ── WAKE LOCK ────────────────────────────────────────────────────────────────
// Mantém a tela ligada; sem suporte, degrada em silêncio. Re-pede ao voltar a
// ficar visível (o wake lock é liberado sozinho quando a aba perde o foco).
async function pedirWakeLock() {
  try {
    if ("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen");
  } catch (e) { /* não suportado ou negado — segue sem wake lock */ }
}
document.addEventListener("visibilitychange", () => {
  if (ativado && document.visibilityState === "visible") pedirWakeLock();
});

// ── GEOLOCALIZAÇÃO / ZAS ──────────────────────────────────────────────────────
function obterPosicao() {
  return new Promise(resolve => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      pos => resolve(pos.coords),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  });
}

// Distância até a "barragem" (fictícia, deslocada do usuário — modo demo
// padrão; ou real, catálogo — ?demo=0) e o texto do bloco ZAS. Roda 1x, no toque.
async function calcularZas() {
  modoDemo = new URLSearchParams(location.search).get("demo") !== "0";
  const coords = await obterPosicao();
  if (!coords) {
    zasDisponivel = false;
    zasTexto = "📍 Localização não autorizada — status da ZAS indisponível";
    return;
  }
  let barragem;
  if (modoDemo) {
    barragem = { lat: coords.latitude + DEMO_DESLOCAMENTO_LAT, lng: coords.longitude };
  } else {
    const pz0 = PIEZOMETROS[0];
    barragem = (pz0 && Number.isFinite(pz0.lat) && Number.isFinite(pz0.lng)) ? pz0 : BARRAGEM_REAL_FALLBACK;
  }
  zasDistanciaKm = haversineKm(coords.latitude, coords.longitude, barragem.lat, barragem.lng);
  zasDisponivel = true;
  const sufixo = modoDemo ? " (fictícia)" : "";
  zasTexto = zasDistanciaKm <= ZAS_RAIO_KM
    ? `📍 Você está na Zona de Autossalvamento — a ${zasDistanciaKm.toFixed(1)} km da barragem${sufixo}`
    : `📍 Fora da Zona de Autossalvamento (raio de ${ZAS_RAIO_KM} km) — a ${zasDistanciaKm.toFixed(1)} km da barragem${sufixo}`;
}

// Monta a mensagem de crítico com a linha de distância já resolvida
function montarMensagemCritico() {
  const linhaZas = zasDisponivel
    ? `📍 A ${zasDistanciaKm.toFixed(1)} km da barragem${modoDemo ? " (fictícia)" : ""}.`
    : "📍 Distância da barragem indisponível (localização não autorizada).";
  return [
    "🚨 ALERTA EXTREMO — SIMULAÇÃO",
    "Risco de rompimento da barragem (fictícia). Você está na Zona de Autossalvamento.",
    "DESLOQUE-SE IMEDIATAMENTE para a área elevada mais próxima, seguindo a rota de fuga.",
    "Não retorne para buscar pertences. Ajude pessoas com dificuldade de locomoção.",
    linhaZas,
    "Simulação acadêmica AquaSense — nenhuma emergência real.",
  ].join("\n");
}

// ── POLL DE /ultimos ─────────────────────────────────────────────────────────
async function pollUltimos() {
  if (emVoo) return; // nunca reentrante
  emVoo = true;
  try {
    const json = await apiGet("/ultimos");
    const row = json && json[pzId];
    if (!row) throw new Error(`${pzId} sem leitura recente`);
    falhasSeguidas = 0;
    processarLeitura({
      nivel: row.nivel_agua,
      ts: row.ts,
      recebidoEm: Number.isFinite(row.recebido_em) ? row.recebido_em : row.ts,
    });
  } catch (e) {
    falhasSeguidas++;
    console.warn("Alerta: poll falhou —", e.message);
    if (falhasSeguidas >= 3) mudarEstado("semsinal", null);
  } finally {
    emVoo = false;
  }
}

function processarLeitura(leitura) {
  if (estadoComunicacao(leitura) === "stale" || !Number.isFinite(leitura.nivel)) {
    mudarEstado("semsinal", null);
    return;
  }
  const cls = classifyNivel(leitura.nivel); // {lv, lbl} — de util.js
  mudarEstado(cls.lv, leitura.nivel);
}

// ── MÁQUINA DE ESTADOS ────────────────────────────────────────────────────────
function mostrarTela(nome) {
  document.querySelectorAll(".tela").forEach(el => { el.hidden = el.id !== `tela-${nome}`; });
}

function mudarEstado(novo, nivel) {
  if (transicaoTimer) return; // aguardando terminar a tela "normalizado" antes de reagir de novo
  if (novo === estadoAtual) {
    if (novo === "normal" || novo === "atencao" || novo === "critico") atualizarTelaMonitor(novo, nivel);
    return;
  }
  const vinhaDoCritico = estadoAtual === "critico";
  estadoAtual = novo;
  if (vinhaDoCritico) {
    pararSirene(); // sempre corta som/vibração ao sair do crítico, não importa pra onde vai
    pararVibracao();
    if (novo === "normal") {
      // só finge "normalizado" quando realmente normalizou — crítico→semsinal (perdeu
      // sinal) ou crítico→atenção (ainda elevado) vão direto pra tela real (nunca mentir)
      document.body.className = "st-normalizado";
      mostrarTela("normalizado");
      transicaoTimer = setTimeout(() => { transicaoTimer = null; aplicarEstado(novo, nivel); }, 4000);
      return;
    }
  }
  aplicarEstado(novo, nivel);
}

function aplicarEstado(novo, nivel) {
  document.body.className = `st-${novo}`;
  if (novo === "atencao") { beepAtencao(); mostrarTela("monitor"); atualizarTelaMonitor("atencao", nivel); }
  else if (novo === "critico") { iniciarSirene(); iniciarVibracao(); mostrarTela("monitor"); atualizarTelaMonitor("critico", nivel); }
  else if (novo === "normal") { mostrarTela("monitor"); atualizarTelaMonitor("normal", nivel); }
  else if (novo === "semsinal") { pararSirene(); pararVibracao(); mostrarTela("semsinal"); }
}

function atualizarTelaMonitor(novo, nivel) {
  const headline = document.getElementById("monitor-headline");
  const nivelEl = document.getElementById("monitor-nivel");
  const msgEl = document.getElementById("monitor-mensagem");
  const zasEl = document.getElementById("bloco-zas");
  const btnSil = document.getElementById("btn-silenciar");
  nivelEl.textContent = Number.isFinite(nivel) ? nivel.toFixed(2) : "--";
  if (novo === "critico") {
    headline.hidden = true;
    msgEl.hidden = false;
    msgEl.textContent = montarMensagemCritico();
    zasEl.hidden = true;
    btnSil.hidden = false;
    btnSil.disabled = false;
    btnSil.textContent = "🔇 Silenciar sirene";
    return;
  }
  headline.hidden = false;
  headline.textContent = novo === "atencao"
    ? "🟡 NÍVEL EM ATENÇÃO — acompanhe as orientações"
    : `🟢 Monitoramento ativo — ${pzId}`;
  msgEl.hidden = true;
  zasEl.hidden = false;
  zasEl.textContent = zasTexto;
  btnSil.hidden = true;
}

// ── ATIVAÇÃO (toque no botão) ─────────────────────────────────────────────────
async function ativar() {
  const btn = document.getElementById("btn-ativar");
  const status = document.getElementById("aguardando-status");
  btn.disabled = true;
  ativado = true;
  // (a) desbloqueia o áudio — precisa nascer dentro do próprio gesto de toque
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") await audioCtx.resume();
  } catch (e) { console.warn("Alerta: áudio indisponível —", e.message); audioCtx = null; }
  // (b) geolocalização / ZAS
  status.textContent = "Obtendo localização (Zona de Autossalvamento)...";
  await calcularZas();
  // (c) wake lock
  await pedirWakeLock();
  // (d) inicia o poll
  status.textContent = "";
  mostrarTela("monitor");
  document.getElementById("monitor-headline").hidden = false;
  document.getElementById("monitor-headline").textContent = "🔘 Conectando ao instrumento...";
  document.getElementById("bloco-zas").textContent = zasTexto;
  pollUltimos();
  pollTimer = setInterval(pollUltimos, 5000);
}

function silenciarSirene() {
  pararSirene();
  const btn = document.getElementById("btn-silenciar");
  btn.textContent = "🔇 Sirene silenciada";
  btn.disabled = true;
}

// ── BOOT ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  await loadConfig(); // busca limiares/piezômetros reais do Worker; fallback hard-coded se falhar
  pzId = (PIEZOMETROS[0] && PIEZOMETROS[0].id) || "PZ-01";
  document.getElementById("btn-ativar").addEventListener("click", ativar);
  document.getElementById("btn-silenciar").addEventListener("click", silenciarSirene);
});
