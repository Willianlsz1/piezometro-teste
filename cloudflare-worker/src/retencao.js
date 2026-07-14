// ── RETENÇÃO DE DADOS ─────────────────────────────────────────────────────────
// Consolida leituras brutas mais antigas que RETENCAO_DIAS em 1 linha/dia/
// piezômetro (tabela `leituras_diario`) e apaga as brutas já consolidadas —
// histórico "infinito" sem deixar a tabela `leituras` crescer sem limite.
// Chamada no máximo 1x/dia pelo scheduled() em index.js (ver estado no KV,
// campo `ultimaRetencao` em alertas.js).

// Executa a consolidação + limpeza. corte = agora - RETENCAO_DIAS dias: tudo
// com ts < corte vira 1 linha/dia/pz em leituras_diario e some de `leituras`.
//
// CUIDADO com o CAST: o D1 (SQLite) faz divisão de INTEIROS em FLOAT se não
// forem explicitamente convertidos — o mesmo bug já corrigido na agregação
// de GET /dados (ver lerDadosAgregados em db.js). CAST(ts/86400 AS INTEGER)
// trunca para o início do dia UTC antes de multiplicar de volta por 86400;
// sem o CAST, "dia" viraria um epoch fracionário e a PRIMARY KEY
// (piezometro, dia) nunca bateria com o dia seguinte, quebrando o
// INSERT OR REPLACE (cada consolidação criaria uma linha nova em vez de
// atualizar a do dia).
export async function executarRetencao(env, cfg) {
  const corte = Math.floor(Date.now() / 1000) - cfg.RETENCAO_DIAS * 86400;

  const consolidado = await env.DB.prepare(
    `INSERT OR REPLACE INTO leituras_diario
            (piezometro, dia, nivel_medio, nivel_min, nivel_max, n_leituras)
     SELECT piezometro,
            CAST(ts / 86400 AS INTEGER) * 86400 AS dia,
            AVG(nivel_agua),
            MIN(nivel_agua),
            MAX(nivel_agua),
            COUNT(*)
       FROM leituras
      WHERE ts < ?1
      GROUP BY piezometro, CAST(ts / 86400 AS INTEGER)`
  )
    .bind(corte)
    .run();

  const apagado = await env.DB.prepare(`DELETE FROM leituras WHERE ts < ?1`).bind(corte).run();

  const diasConsolidados = consolidado.meta?.changes ?? 0;
  const linhasApagadas = apagado.meta?.changes ?? 0;
  console.log(
    `🗄️ Retenção: ${diasConsolidados} dia(s)/piezômetro consolidado(s) em leituras_diario, ${linhasApagadas} leitura(s) bruta(s) apagada(s) (corte=${corte})`
  );

  return { diasConsolidados, linhasApagadas };
}
