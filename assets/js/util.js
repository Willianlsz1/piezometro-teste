// ── UTIL ──────────────────────────────────────────────────────────────────────
// Funções puras, sem estado nem efeitos colaterais: classificação de faixa de
// nível (com e sem histerese), cor por status, estado de comunicação e formatação
// de "há X min/h/d" a partir de um timestamp. Usadas por praticamente todo o resto.

const clamp = (v, mn, mx) => Math.max(mn, Math.min(mx, v));

// Classifica um nível d'água (m) nas 3 faixas do desafio SAGA
function classifyNivel(n) {
  if (n < CFG.thrAtencao) return { lv: "normal",  lbl: "Normal" };
  if (n < CFG.thrCritico) return { lv: "atencao", lbl: "Atenção" };
  return { lv: "critico", lbl: "Crítico" };
}
function corPorStatus(lv) {
  return { normal: "#3ecf7a", atencao: "#f0c040", critico: "#f04848", info: "#4da8f0", semsinal: "#8a90a3" }[lv] || "#4da8f0";
}

// P4 — histerese na detecção de borda (ISA-18.2: evita repicar bem em cima do limiar).
// Na SUBIDA de faixa a classificação é imediata (prioridade é detectar risco rápido); na
// DESCIDA só confirma a faixa nova quando o nível cair abaixo de (limiar da faixa anterior −
// CFG.histereseM). Helper puro, reaproveita classifyNivel — usado tanto para decidir se
// registra uma linha de alarme/evento quanto para o badge/faixa exibida (mesma regra:
// o badge não fica piscando na borda).
function classifyComHisterese(nivel, faixaAnterior) {
  const bruta = classifyNivel(nivel);
  if (!faixaAnterior || bruta.lv === faixaAnterior) return bruta;
  const ordem = { normal: 0, atencao: 1, critico: 2 };
  const subindo = ordem[bruta.lv] > ordem[faixaAnterior];
  if (subindo) return bruta;
  // descida: só confirma se caiu abaixo do limiar da faixa anterior menos a histerese;
  // senão, mantém a classificação da faixa anterior (não pisca na borda)
  if (faixaAnterior === "critico") {
    return nivel < (CFG.thrCritico - CFG.histereseM) ? bruta : { lv: "critico", lbl: "Crítico" };
  }
  if (faixaAnterior === "atencao") {
    return nivel < (CFG.thrAtencao - CFG.histereseM) ? bruta : { lv: "atencao", lbl: "Atenção" };
  }
  return bruta;
}

// ── ESTADO DE COMUNICAÇÃO (P1) ───────────────────────────────────────────────
// Helper puro: decide se a leitura de um piezômetro está "ok" ou "stale" (sem sinal).
// Dado ausente NUNCA é avaliado como normal — ver docs/DASHBOARD_PROFISSIONAL.md §2.
function estadoComunicacao(leitura) {
  if (!leitura || !Number.isFinite(leitura.ts)) return "stale";
  const idadeSeg = Date.now() / 1000 - leitura.ts;
  return idadeSeg > CFG.staleSeg ? "stale" : "ok";
}

// Formata "há X min/h/d" a partir de um timestamp em segundos (epoch)
function formatUltimaLeitura(ts) {
  if (!Number.isFinite(ts)) return "sem dados";
  const seg = Math.max(0, Date.now() / 1000 - ts);
  const min = Math.floor(seg / 60);
  if (min < 1) return "há <1 min";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} d`;
}
