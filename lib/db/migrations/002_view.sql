-- View central consumida por materiais.service e historico.service.
-- Equivalente SQLite da vw_estoque_contagem de produção (ILIKE → LIKE;
-- LIKE no SQLite já é case-insensitive para ASCII).

DROP VIEW IF EXISTS vw_estoque_contagem;

CREATE VIEW vw_estoque_contagem AS
SELECT
  se.id                               AS id,
  se.origem                           AS origem,
  se.contrato                         AS contrato,
  se.grupo                            AS grupo,
  se.codmat                           AS codmat,
  se.descricao                        AS descricao,
  se.unidade                          AS unidade,
  se.saldo_estoque                    AS "saldoAtual",
  se.valor                            AS "precoUnitario",
  se.classe_abc                       AS "classeABC",
  pc.quantidade_contada               AS "ultimaContagemFisica"
FROM saldo_estoque se
LEFT JOIN progresso_contagem pc
  ON pc.codmat = se.codmat AND pc.cidade = se.origem AND pc.grupo = se.grupo;
