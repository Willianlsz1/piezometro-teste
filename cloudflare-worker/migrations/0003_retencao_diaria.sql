-- ── Migração 0003 — tabela de consolidação diária (retenção de dados) ───────
-- Histórico "infinito" com banco enxuto: leituras brutas mais antigas que
-- RETENCAO_DIAS (wrangler.toml, default 180 dias — 6x o maior range servido
-- pelo dashboard, 30d) são resumidas em 1 linha/dia/piezômetro nesta tabela
-- e depois apagadas de `leituras` (ver src/retencao.js, chamado 1x/dia pelo
-- scheduled() em index.js). Nenhum endpoint consome `leituras_diario` ainda
-- — fica disponível para uma futura análise de longo prazo (evolução, não
-- requisito deste TCC).
--
-- IMPORTANTE: aplique esta migração ANTES do `wrangler deploy` da versão
-- que roda a retenção — sem a tabela, o INSERT OR REPLACE de
-- executarRetencao() falharia.
--
-- Aplique com:
--   wrangler d1 execute piezometro-db --remote --file=migrations/0003_retencao_diaria.sql

CREATE TABLE IF NOT EXISTS leituras_diario (
  piezometro  TEXT NOT NULL,                -- identificador do sensor (ex.: "PZ-01")
  dia         INTEGER NOT NULL,             -- epoch em SEGUNDOS do início do dia UTC (00:00)
  nivel_medio REAL,                          -- média do nível d'água no dia, em metros
  nivel_min   REAL,                          -- mínimo do nível d'água no dia, em metros
  nivel_max   REAL,                          -- máximo do nível d'água no dia, em metros
  n_leituras  INTEGER,                       -- nº de leituras brutas que formaram o resumo do dia
  PRIMARY KEY (piezometro, dia)
);
