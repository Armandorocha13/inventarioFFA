-- Schema base do SGI (dialeto SQLite — banco de desenvolvimento).
-- Espelha as tabelas usadas em produção (Neon/Postgres).

CREATE TABLE IF NOT EXISTS de_para_projeto (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  contrato  INTEGER,
  cidade    TEXT,
  projeto   TEXT
);

CREATE TABLE IF NOT EXISTS de_para_itens (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  grupo   TEXT,
  codmat  TEXT,
  UNIQUE (grupo, codmat)
);

CREATE TABLE IF NOT EXISTS saldo_estoque (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  data                TEXT,
  origem              TEXT,
  contrato            INTEGER,
  grupo               TEXT,
  codmat              TEXT,
  descricao           TEXT,
  unidade             TEXT,
  saldo_estoque       REAL,
  saldo_disponivel    REAL,
  valor               REAL,
  total_real          REAL,
  classe_abc          TEXT
);

CREATE INDEX IF NOT EXISTS idx_saldo_estoque_grupo_codmat
  ON saldo_estoque (grupo, codmat);
CREATE INDEX IF NOT EXISTS idx_saldo_estoque_contrato
  ON saldo_estoque (contrato);
CREATE INDEX IF NOT EXISTS idx_saldo_estoque_origem
  ON saldo_estoque (origem);

CREATE TABLE IF NOT EXISTS progresso_contagem (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  cidade              TEXT,
  grupo               TEXT,
  codmat              TEXT,
  quantidade_contada  REAL,
  atualizado_em       TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (cidade, grupo, codmat)
);

-- Tabela de auditoria real (não existia no banco anterior — o histórico
-- era derivado da view). Uma linha por item contado.
CREATE TABLE IF NOT EXISTS historico_contagem (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  codmat          TEXT,
  descricao       TEXT,
  valor_anterior  REAL,
  valor_novo      REAL,
  desvio          REAL,
  observacao      TEXT,
  origem          TEXT,
  grupo           TEXT,
  timestamp       TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_historico_origem
  ON historico_contagem (origem);
