-- ── Piezômetro — Schema D1 (SQLite) ─────────────────────────────────────────
-- Tabela única com todas as leituras de todos os piezômetros. Substitui o
-- InfluxDB: sem measurement/bucket, é só uma tabela relacional com índice
-- por (piezometro, ts) para as consultas de "última leitura" e "série
-- histórica" ficarem rápidas.
--
-- Aplique com:
--   wrangler d1 execute piezometro-db --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS leituras (
  id          INTEGER PRIMARY KEY AUTOINCREMENT, -- identificador interno, auto-incremental
  piezometro  TEXT NOT NULL DEFAULT 'PZ-01',      -- identificador do sensor (ex.: "PZ-01")
  nivel_agua  REAL NOT NULL,                      -- nível d'água medido, em metros
  pressao     REAL,                               -- pressão atmosférica opcional, em hPa
  temperatura REAL,                                -- temperatura opcional, em °C
  ts          INTEGER NOT NULL,                   -- instante da leitura (medição), epoch em SEGUNDOS
  recebido_em INTEGER                              -- instante em que o Worker recebeu a leitura, epoch em
                                                    -- SEGUNDOS (nullable) — fonte de frescor, imune à deriva
                                                    -- do relógio do device
);

-- Acelera tanto o "SELECT última leitura de cada piezômetro" (MAX(id) por
-- piezometro) quanto as agregações por janela de tempo (WHERE piezometro = ?
-- AND ts >= ?), que são os dois padrões de consulta usados pelo Worker.
CREATE INDEX IF NOT EXISTS idx_leituras_pz_ts ON leituras (piezometro, ts);

-- Reenvio idempotente do buffer store & forward do firmware (ex.: HTTP 204
-- de confirmação perdido) não deve duplicar a linha — o INSERT OR IGNORE em
-- db.js depende deste índice único para descartar a repetição.
CREATE UNIQUE INDEX IF NOT EXISTS idx_leituras_pz_ts_unico ON leituras (piezometro, ts);
