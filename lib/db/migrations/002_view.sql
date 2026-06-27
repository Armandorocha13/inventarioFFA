-- View central consumida por materiais.service e historico.service.
-- Equivalente SQLite da vw_estoque_contagem de produção (ILIKE → LIKE;
-- LIKE no SQLite já é case-insensitive para ASCII).

DROP VIEW IF EXISTS vw_estoque_contagem;

CREATE VIEW vw_estoque_contagem AS
SELECT
  MAX(se.id)                          AS id,
  dp.cidade                           AS origem,
  CAST(se.grupo_codigo AS INTEGER)    AS contrato,
  se.grupo                            AS grupo,
  se.codmat                           AS codmat,
  se.descricao                        AS descricao,
  MAX(se.unid)                        AS unidade,
  SUM(se.saldo_estoque)               AS "saldoAtual",
  MAX(se.valor)                       AS "precoUnitario",
  MAX(pc.quantidade_contada)          AS "ultimaContagemFisica"
FROM saldo_estoque se
JOIN (
  SELECT contrato, MAX(TRIM(cidade)) AS cidade
    FROM de_para_projeto
   GROUP BY contrato
) dp ON CAST(se.grupo_codigo AS INTEGER) = dp.contrato
JOIN de_para_itens dpi
  ON se.grupo = dpi.grupo AND se.codmat = dpi.codmat
LEFT JOIN progresso_contagem pc
  ON pc.codmat = se.codmat AND pc.cidade = dp.cidade AND pc.grupo = se.grupo
WHERE se.codmat   NOT LIKE 'S%'
  AND se.descricao NOT LIKE 'SUC-%'
  AND COALESCE(se.codcpl, '') NOT LIKE '%SUCATA%'
  -- Exclui itens RJO do Contrato 1 (Contrato 1 é de SP)
  AND NOT (CAST(se.grupo_codigo AS INTEGER) = 1 AND se.grupo LIKE '%RJO%')
GROUP BY dp.cidade, CAST(se.grupo_codigo AS INTEGER), se.grupo, se.codmat, se.descricao;
