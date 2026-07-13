// ── EXPORTAR CSV (Excel pt-BR) ────────────────────────────────────────────────
// Gera e baixa um CSV do histórico de nível d'água do PERÍODO INTEIRO selecionado
// (histPontos.n, semeado em loadHistoryAndStats — não charts.n, que os gráficos truncam a
// 60 pontos e por isso não cobre o período que o nome do arquivo promete), no formato
// aceito pelo Excel em pt-BR.
//
// CSV de auditoria: além das colunas de série, um bloco de metadados no topo (instrumento,
// período, intervalo de agregação, quando foi gerado, se os dados são reais ou simulados e
// os limiares vigentes) — para que o arquivo, sozinho, sirva de evidência em uma revisão de
// segurança, sem depender do operador lembrar o contexto em que foi exportado.

function exportCSV() {
  // Fallback para charts.n só no caso (não esperado em uso normal) de exportar antes de
  // qualquer loadHistoryAndStats ter rodado e semeado histPontos.n. Dados vindos desse
  // fallback não têm mín/nº de leituras — os campos ficam `undefined` (tratado abaixo).
  const pontos = histPontos.n.length
    ? histPontos.n.map(h => ({ time: h.time, value: h.value, max: h.maxValue, min: h.minValue, n: h.nLeituras }))
    : charts.n.data.map((v, i) => ({
        time: charts.n.times[i],
        value: v,
        max: (charts.n.maxData && Number.isFinite(charts.n.maxData[i])) ? charts.n.maxData[i] : v,
        min: undefined,
        n: undefined,
      }));

  const rows = pontos.map(h => {
    const dt = h.time ? new Date(h.time) : new Date();
    const dataHora = dt.toLocaleString("pt-BR");
    // P5 — Status calculado sobre o PICO do intervalo (h.max), nunca a média: um pico de
    // 17 m dentro de um intervalo de média 7,5 m não pode sair como "Normal".
    const status = classifyNivel(h.max).lbl;
    const nivelFmt = String(h.value.toFixed(2)).replace(".", ",");
    const maxFmt = String(h.max.toFixed(2)).replace(".", ",");
    const minFmt = Number.isFinite(h.min) ? String(h.min.toFixed(2)).replace(".", ",") : "";
    const nFmt = Number.isFinite(h.n) ? String(h.n) : "";

    let qualidade = "ok";
    if (h.max === 0) qualidade = "suspeito: nível zero";
    else if (Number.isFinite(h.n) && h.n < 3) qualidade = "poucas leituras";

    return [dataHora, pzSelecionado, nivelFmt, minFmt, maxFmt, nFmt, status, qualidade].join(";");
  });

  const geradoEm = new Date().toLocaleString("pt-BR");
  const intervaloMin = Number.isFinite(histPontos.bucketSeg) ? String(Math.round(histPontos.bucketSeg / 60)) : "ao vivo";
  const fonteDados = fonte.simulada ? "SIMULAÇÃO — dados fictícios de demonstração" : "API real";
  const metadados = [
    `Instrumento;${pzSelecionado}`,
    `Período solicitado;${periodoSelecionado}`,
    `Intervalo de agregação;${intervaloMin === "ao vivo" ? intervaloMin : intervaloMin + " min"}`,
    `Gerado em;${geradoEm}`,
    `Fonte dos dados;${fonteDados}`,
    `Limiares vigentes;atenção ${String(CFG.thrAtencao).replace(".", ",")} m / crítico ${String(CFG.thrCritico).replace(".", ",")} m`,
    `Total de intervalos exportados;${rows.length}`,
  ];

  const header = ["Data/Hora", "Piezômetro", "Nível médio (m)", "Nível mín (m)", "Nível máx (m)", "Leituras no intervalo", "Status (pelo pico)", "Qualidade"].join(";");
  const content = "﻿" + [...metadados, "", header, ...rows].join("\r\n");
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
