-- ── Migração 0001 — adiciona recebido_em ────────────────────────────────────
-- Bancos já criados com o schema.sql antigo (sem a coluna recebido_em)
-- precisam deste ALTER para receber o carimbo de hora de RECEBIMENTO em cada
-- leitura (usado para frescor/comunicação, imune à deriva do relógio do
-- device no Wokwi). Linhas antigas ficam com recebido_em NULL; os
-- consumidores (db.js, alertas.js) fazem fallback para ts nesse caso.
--
-- IMPORTANTE: aplique esta migração ANTES do `wrangler deploy` da versão que
-- usa recebido_em — o INSERT/SELECT do Worker novo referencia a coluna e
-- falharia num banco ainda sem ela (ingestão fora do ar até migrar).
--
-- Aplique com:
--   wrangler d1 execute piezometro-db --remote --file=migrations/0001_recebido_em.sql

ALTER TABLE leituras ADD COLUMN recebido_em INTEGER;
