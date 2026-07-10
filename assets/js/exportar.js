// ── EXPORTAR CSV (Excel pt-BR) ────────────────────────────────────────────────
// Gera e baixa um CSV do histórico de nível d'água atualmente carregado no
// gráfico principal (charts.n), no formato aceito pelo Excel em pt-BR.

function exportCSV() {
  const rows = charts.n.data.map((v, i) => {
    const iso = charts.n.times[i];
    const dt = iso ? new Date(iso) : new Date();
    const dataHora = dt.toLocaleString("pt-BR");
    const status = classifyNivel(v).lbl;
    const nivelFmt = String(v.toFixed(2)).replace(".", ",");
    // P5 — coluna de pico do intervalo (cai para o próprio valor quando não há pico agregado)
    const maxV = charts.n.maxData && Number.isFinite(charts.n.maxData[i]) ? charts.n.maxData[i] : v;
    const maxFmt = String(maxV.toFixed(2)).replace(".", ",");
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
