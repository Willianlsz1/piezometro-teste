// ── EXPORTAR CSV (Excel pt-BR) ────────────────────────────────────────────────
// Gera e baixa um CSV do histórico de nível d'água do PERÍODO INTEIRO selecionado
// (histPontos.n, semeado em loadHistoryAndStats — não charts.n, que os gráficos truncam a
// 60 pontos e por isso não cobre o período que o nome do arquivo promete), no formato
// aceito pelo Excel em pt-BR.

function exportCSV() {
  // Fallback para charts.n só no caso (não esperado em uso normal) de exportar antes de
  // qualquer loadHistoryAndStats ter rodado e semeado histPontos.n.
  const pontos = histPontos.n.length
    ? histPontos.n.map(h => ({ time: h.time, value: h.value, max: h.maxValue }))
    : charts.n.data.map((v, i) => ({
        time: charts.n.times[i],
        value: v,
        max: (charts.n.maxData && Number.isFinite(charts.n.maxData[i])) ? charts.n.maxData[i] : v,
      }));

  const rows = pontos.map(h => {
    const dt = h.time ? new Date(h.time) : new Date();
    const dataHora = dt.toLocaleString("pt-BR");
    const status = classifyNivel(h.value).lbl;
    const nivelFmt = String(h.value.toFixed(2)).replace(".", ",");
    // P5 — coluna de pico do intervalo (cai para o próprio valor quando não há pico agregado)
    const maxFmt = String(h.max.toFixed(2)).replace(".", ",");
    return [dataHora, pzSelecionado, nivelFmt, maxFmt, status].join(";");
  });
  const header = ["Data/Hora", "Piezômetro", "Nível (m)", "Nível Máx (m)", "Status"].join(";");
  const content = "﻿" + [header, ...rows].join("\r\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `piezometro_${pzSelecionado}_${periodoSelecionado}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
