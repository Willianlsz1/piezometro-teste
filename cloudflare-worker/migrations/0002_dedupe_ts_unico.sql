-- ── Migração 0002 — deduplica leituras e cria índice único (piezometro, ts) ──
-- Reenvio do buffer store & forward do firmware (ex.: HTTP 204 de
-- confirmação perdido pelo device, que reenvia o mesmo lote) vinha
-- duplicando linhas em (piezometro, ts) e distorcendo AVG/MAX na agregação
-- dos gráficos (/dados). Esta migração primeiro limpa as duplicatas já
-- gravadas e depois cria o índice único que faz o INSERT OR IGNORE (db.js)
-- descartar futuras repetições sem erro.
--
-- IMPORTANTE: aplique esta migração ANTES do `wrangler deploy` da versão
-- que usa INSERT OR IGNORE — sem o índice único, o OR IGNORE não tem o que
-- ignorar e duplicatas voltariam a entrar (ingestão continuaria, mas sem
-- a proteção contra duplicação).
--
-- Aplique com:
--   wrangler d1 execute piezometro-db --remote --file=migrations/0002_dedupe_ts_unico.sql

-- Mantém só a linha de MAIOR id (mais recente) para cada par (piezometro, ts).
DELETE FROM leituras WHERE id NOT IN (SELECT MAX(id) FROM leituras GROUP BY piezometro, ts);

CREATE UNIQUE INDEX IF NOT EXISTS idx_leituras_pz_ts_unico ON leituras (piezometro, ts);
