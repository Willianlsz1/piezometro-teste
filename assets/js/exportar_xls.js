// ── EXPORTAR EXCEL (SpreadsheetML 2003) ──────────────────────────────────────
// Gera o XML de uma planilha Excel "SpreadsheetML 2003" (Excel XML Workbook) como
// string pura, sem nenhuma biblioteca externa — só o que o navegador já tem. Excel
// abre esse formato com um aviso leve ("o formato é diferente da extensão"); é
// esperado e inofensivo, o usuário só clica em "Sim/Continuar".
//
// Este módulo só sabe montar XML a partir de dados já prontos (linhas + metadados);
// quem decide O QUE exportar (seleção de pontos, cálculo de status/qualidade) é
// exportar.js — mesma separação que fontes.js/estado.js já seguem no resto do app.

// Escapa texto para uso seguro dentro de elementos/atributos XML.
function escapeXml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// Formata número em pt-BR (vírgula decimal); string vazia quando não finito.
function numPt(n, casas) {
  return Number.isFinite(n) ? n.toFixed(casas == null ? 2 : casas).replace(".", ",") : "";
}

// ── CATÁLOGO DE ESTILOS ──────────────────────────────────────────────────────
// Cores lidas de util.js (corPorStatus) — clareadas aqui só para legibilidade de
// texto escuro sobre o fundo da célula de Status (a cor "cheia" é usada nos badges
// do dashboard; texto branco/preto direto sobre ela dá contraste ruim numa planilha).
const XLS_CORES_STATUS = {
  normal:  { bg: "#C9F5DA", fg: "#14532D" },
  atencao: { bg: "#FDEEB3", fg: "#7A5B00" },
  critico: { bg: "#FBD2D2", fg: "#7A1414" },
};

function xmlStyle(id, { bg, fg, bold, size, align, wrap } = {}) {
  const font = `<Font ss:Bold="${bold ? 1 : 0}"${size ? ` ss:Size="${size}"` : ""}${fg ? ` ss:Color="${fg}"` : ""}/>`;
  const interior = bg ? `<Interior ss:Color="${bg}" ss:Pattern="Solid"/>` : "";
  const alignment = `<Alignment ss:Horizontal="${align || "Left"}" ss:Vertical="Center"${wrap ? ` ss:WrapText="1"` : ""}/>`;
  const borders = `<Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D0D4DC"/></Borders>`;
  return `<Style ss:ID="${id}">${font}${interior}${alignment}${borders}</Style>`;
}

function xmlStyles() {
  return "<Styles>" + [
    xmlStyle("sTitulo",   { bg: "#12172A", fg: "#E8ECF5", bold: true, size: 14, align: "Center" }),
    xmlStyle("sContexto", { bg: "#1E2740", fg: "#C6CCDA", bold: false, size: 10, align: "Center" }),
    xmlStyle("sMeta",     { bg: "#1E2740", fg: "#C6CCDA", bold: false, size: 9,  align: "Center" }),
    xmlStyle("sHeader",   { bg: "#22314F", fg: "#FFFFFF", bold: true, size: 10, align: "Center", wrap: true }),
    xmlStyle("sCelula",   { align: "Left" }),
    xmlStyle("sCelulaNum", { align: "Right" }),
    xmlStyle("sStatusNormal",  { bg: XLS_CORES_STATUS.normal.bg,  fg: XLS_CORES_STATUS.normal.fg,  bold: true, align: "Center" }),
    xmlStyle("sStatusAtencao", { bg: XLS_CORES_STATUS.atencao.bg, fg: XLS_CORES_STATUS.atencao.fg, bold: true, align: "Center" }),
    xmlStyle("sStatusCritico", { bg: XLS_CORES_STATUS.critico.bg, fg: XLS_CORES_STATUS.critico.fg, bold: true, align: "Center" }),
    xmlStyle("sResumoTitulo", { bg: "#12172A", fg: "#E8ECF5", bold: true, size: 12, align: "Center" }),
    xmlStyle("sResumoHeader", { bg: "#2E3B5C", fg: "#FFFFFF", bold: true, size: 10, align: "Center", wrap: true }),
    xmlStyle("sResumoCelula", { align: "Center" }),
  ].join("") + "</Styles>";
}

function styleIdPorStatus(lv) {
  return { normal: "sStatusNormal", atencao: "sStatusAtencao", critico: "sStatusCritico" }[lv] || "sCelula";
}

// ── MONTAGEM DE CÉLULAS / LINHAS ─────────────────────────────────────────────
function cell(texto, { styleId, mergeAcross, tipo } = {}) {
  const attrs = (styleId ? ` ss:StyleID="${styleId}"` : "") + (mergeAcross ? ` ss:MergeAcross="${mergeAcross}"` : "");
  return `<Cell${attrs}><Data ss:Type="${tipo || "String"}">${escapeXml(texto)}</Data></Cell>`;
}
function row(cells) {
  return `<Row>${cells.join("")}</Row>`;
}

// ── PLANILHA COMPLETA ─────────────────────────────────────────────────────────
// `linhas`: array de { dataHora, pz, value, min, max, n, status, statusLv, qualidade }
// (mesma forma usada por exportCSV, ver exportar.js). `meta`: metadados de contexto/
// auditoria (instrumento, período, intervalo, fonte, limiares, quando foi gerado).
function gerarPlanilhaXLS(linhas, meta) {
  const NUM_COLS = 8;
  const rows = [];

  rows.push(row([cell("MONITORAMENTO DE NÍVEL D'ÁGUA EM PIEZÔMETROS — RELATÓRIO DE LEITURAS", { styleId: "sTitulo", mergeAcross: NUM_COLS - 1 })]));
  rows.push(row([cell(
    `Instrumento: ${meta.pz}  |  Período: ${meta.periodoLabel}  |  Intervalo de agregação: ${meta.intervaloLabel}  |  Fonte: ${meta.fonteLabel}`,
    { styleId: "sContexto", mergeAcross: NUM_COLS - 1 }
  )]));
  rows.push(row([cell(
    `Gerado em: ${meta.geradoEm}  |  Limiares: atenção ${meta.thrAtencaoFmt} m / crítico ${meta.thrCriticoFmt} m  |  Total de intervalos: ${linhas.length}`,
    { styleId: "sMeta", mergeAcross: NUM_COLS - 1 }
  )]));

  rows.push(row([
    "Data/Hora", "Piezômetro", "Nível médio (m)", "Nível mín (m)", "Nível máx (m)",
    "Leituras no intervalo", "Status (pelo pico)", "Qualidade",
  ].map(txt => cell(txt, { styleId: "sHeader" }))));

  linhas.forEach(l => {
    rows.push(row([
      cell(l.dataHora, { styleId: "sCelula" }),
      cell(l.pz, { styleId: "sCelula" }),
      cell(numPt(l.value, 2), { styleId: "sCelulaNum" }),
      cell(Number.isFinite(l.min) ? numPt(l.min, 2) : "", { styleId: "sCelulaNum" }),
      cell(numPt(l.max, 2), { styleId: "sCelulaNum" }),
      cell(Number.isFinite(l.n) ? String(l.n) : "", { styleId: "sCelulaNum" }),
      cell(l.status, { styleId: styleIdPorStatus(l.statusLv) }),
      cell(l.qualidade, { styleId: "sCelula" }),
    ]));
  });

  rows.push(row([cell("")]));

  rows.push(row([cell("RESUMO DO PERÍODO", { styleId: "sResumoTitulo", mergeAcross: 4 })]));
  rows.push(row([
    "Nível mínimo do período", "Nível máximo do período", "Média do período",
    "Intervalos em Atenção (pelo pico)", "Intervalos em Crítico (pelo pico)",
  ].map(txt => cell(txt, { styleId: "sResumoHeader" }))));
  rows.push(row([
    cell(numPt(meta.resumo.min, 2), { styleId: "sResumoCelula" }),
    cell(numPt(meta.resumo.max, 2), { styleId: "sResumoCelula" }),
    cell(numPt(meta.resumo.media, 2), { styleId: "sResumoCelula" }),
    cell(String(meta.resumo.nAtencao), { styleId: "sResumoCelula" }),
    cell(String(meta.resumo.nCritico), { styleId: "sResumoCelula" }),
  ]));

  const colunas = Array.from({ length: NUM_COLS }, (_, i) =>
    `<Column ss:Width="${[110, 90, 110, 90, 90, 120, 110, 150][i]}"/>`
  ).join("");

  return '<?xml version="1.0"?>\r\n' +
    '<?mso-application progid="Excel.Sheet"?>\r\n' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ' +
    'xmlns:o="urn:schemas-microsoft-com:office:office" ' +
    'xmlns:x="urn:schemas-microsoft-com:office:excel" ' +
    'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" ' +
    'xmlns:html="http://www.w3.org/TR/REC-html40">' +
    xmlStyles() +
    '<Worksheet ss:Name="Relatorio"><Table>' + colunas + rows.join("") + '</Table></Worksheet>' +
    '</Workbook>';
}
