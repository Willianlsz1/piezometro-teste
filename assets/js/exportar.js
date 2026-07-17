// ── EXPORTAR (CSV bruto + Excel formatado) ───────────────────────────────────
// Gera e baixa o histórico de nível d'água do PERÍODO INTEIRO selecionado (histPontos.n,
// semeado em loadHistoryAndStats — não charts.n, que os gráficos truncam a 60 pontos e por
// isso não cobre o período que o nome do arquivo promete), em dois formatos:
//   - CSV: "dados brutos" no formato aceito pelo Excel em pt-BR, com bloco de metadados
//     de auditoria no topo (ver exportCSV) — serve, sozinho, de evidência numa revisão.
//   - XLS: planilha formatada (título, cabeçalho colorido, status por cor, resumo do
//     período) gerada em SpreadsheetML por exportar_xls.js — mesma fonte de dados, layout
//     de leitura mais direta para quem não abre o CSV bruto.
//
// coletarLinhasExportacao() é o ÚNICO ponto que decide os pontos/status/qualidade
// exportados — CSV e XLS partem exatamente das mesmas linhas, nunca duplicam a regra
// (P5: status sempre pelo PICO do intervalo, nunca a média).

function coletarLinhasExportacao() {
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

  return pontos.map(h => {
    const dt = h.time ? new Date(h.time) : new Date();
    const dataHora = dt.toLocaleString("pt-BR");
    // P5 — Status calculado sobre o PICO do intervalo (h.max), nunca a média: um pico de
    // 17 m dentro de um intervalo de média 7,5 m não pode sair como "Normal".
    const statusObj = classifyNivel(h.max);

    let qualidade = "ok";
    if (h.max === 0) qualidade = "suspeito: nível zero";
    else if (Number.isFinite(h.n) && h.n < 3) qualidade = "poucas leituras";

    return {
      dataHora, pz: pzSelecionado, value: h.value, min: h.min, max: h.max, n: h.n,
      status: statusObj.lbl, statusLv: statusObj.lv, qualidade,
    };
  });
}

// Metadados de contexto/auditoria compartilhados por CSV e XLS.
function coletarMetaExportacao(totalLinhas) {
  const geradoEm = new Date().toLocaleString("pt-BR");
  const intervaloMin = Number.isFinite(histPontos.bucketSeg) ? String(Math.round(histPontos.bucketSeg / 60)) : "ao vivo";
  return {
    pz: pzSelecionado,
    periodoLabel: periodoSelecionado,
    intervaloLabel: intervaloMin === "ao vivo" ? intervaloMin : intervaloMin + " min",
    geradoEm,
    // histSimulado cobre o fallback local: fonte global ainda é FonteApi, mas o
    // histórico exibido/exportado veio da simulação (API de histórico fora do ar).
    fonteLabel: (fonte.simulada || histSimulado) ? "SIMULAÇÃO — dados fictícios de demonstração" : "API real",
    thrAtencaoFmt: String(CFG.thrAtencao).replace(".", ","),
    thrCriticoFmt: String(CFG.thrCritico).replace(".", ","),
    totalIntervalos: totalLinhas,
  };
}

function baixarArquivo(conteudo, tipoMime, nomeArquivo) {
  const blob = new Blob([conteudo], { type: tipoMime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportCSV() {
  const linhas = coletarLinhasExportacao();
  const meta = coletarMetaExportacao(linhas.length);

  const rows = linhas.map(l => {
    const nivelFmt = String(l.value.toFixed(2)).replace(".", ",");
    const maxFmt = String(l.max.toFixed(2)).replace(".", ",");
    const minFmt = Number.isFinite(l.min) ? String(l.min.toFixed(2)).replace(".", ",") : "";
    const nFmt = Number.isFinite(l.n) ? String(l.n) : "";
    return [l.dataHora, l.pz, nivelFmt, minFmt, maxFmt, nFmt, l.status, l.qualidade].join(";");
  });

  const metadados = [
    `Instrumento;${meta.pz}`,
    `Período solicitado;${meta.periodoLabel}`,
    `Intervalo de agregação;${meta.intervaloLabel}`,
    `Gerado em;${meta.geradoEm}`,
    `Fonte dos dados;${meta.fonteLabel}`,
    `Limiares vigentes;atenção ${meta.thrAtencaoFmt} m / crítico ${meta.thrCriticoFmt} m`,
    `Total de intervalos exportados;${meta.totalIntervalos}`,
  ];

  const header = ["Data/Hora", "Piezômetro", "Nível médio (m)", "Nível mín (m)", "Nível máx (m)", "Leituras no intervalo", "Status (pelo pico)", "Qualidade"].join(";");
  const content = "﻿" + [...metadados, "", header, ...rows].join("\r\n");
  baixarArquivo(content, "text/csv;charset=utf-8;", `piezometro_${pzSelecionado}_${periodoSelecionado}.csv`);
}

// Planilha Excel formatada (SpreadsheetML, ver exportar_xls.js): título, cabeçalho
// colorido, status por cor e uma seção de resumo do período — mesmas linhas do CSV.
function exportXLS() {
  const linhas = coletarLinhasExportacao();
  const meta = coletarMetaExportacao(linhas.length);

  const minsFinitos = linhas.map(l => Number.isFinite(l.min) ? l.min : l.value);
  const maxsFinitos = linhas.map(l => l.max).filter(Number.isFinite);
  const valoresFinitos = linhas.map(l => l.value).filter(Number.isFinite);
  meta.resumo = {
    min: minsFinitos.length ? Math.min(...minsFinitos) : NaN,
    max: maxsFinitos.length ? Math.max(...maxsFinitos) : NaN,
    media: valoresFinitos.length ? valoresFinitos.reduce((a, b) => a + b, 0) / valoresFinitos.length : NaN,
    nAtencao: linhas.filter(l => l.statusLv === "atencao").length,
    nCritico: linhas.filter(l => l.statusLv === "critico").length,
  };

  const xml = gerarPlanilhaXLS(linhas, meta);
  baixarArquivo(xml, "application/vnd.ms-excel;charset=utf-8;", `piezometro_${pzSelecionado}_${periodoSelecionado}.xls`);
}
