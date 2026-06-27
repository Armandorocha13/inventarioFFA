/**
 * Consulta de histórico de contagens.
 *
 * Fase A — preserva comportamento atual: lê da view `vw_estoque_contagem`
 * filtrando por `origem = 'RIO DE JANEIRO' AND contrato = 21`.
 *
 * Fase B — passará a ler de uma tabela `historico_contagem` real e
 * remover os hardcodes de UF/contrato.
 */
import { db } from '@/lib/db';
import type { HistoricoRegistro } from '@/lib/domain/types';

interface HistoricoRow {
  id: number;
  codmat: string | null;
  descricao: string | null;
  valorAnterior: string | number | null;
  valorNovo: string | number | null;
  desvio: string | number | null;
  observacao: string | null;
  timestamp: string;
}

export async function listarHistorico(): Promise<HistoricoRegistro[]> {
  const { rows } = await db.query<HistoricoRow>(
    `
    SELECT
      id,
      codmat,
      descricao,
      "saldoAtual"            AS "valorAnterior",
      "ultimaContagemFisica"  AS "valorNovo",
      ("ultimaContagemFisica" - "saldoAtual") AS desvio,
      NULL                    AS observacao,
      CURRENT_TIMESTAMP       AS timestamp
    FROM vw_estoque_contagem
    WHERE "ultimaContagemFisica" IS NOT NULL
      AND origem = 'RIO DE JANEIRO' AND contrato = 21
    ORDER BY descricao
    LIMIT 100
    `
  );

  return rows.map((row) => ({
    id: row.id,
    codmat: row.codmat ? row.codmat.trim() : '',
    descricao: row.descricao ? row.descricao.trim() : '',
    valorAnterior: row.valorAnterior != null ? parseFloat(String(row.valorAnterior)) : null,
    valorNovo: row.valorNovo != null ? parseFloat(String(row.valorNovo)) : 0,
    desvio: row.desvio != null ? parseFloat(String(row.desvio)) : 0,
    observacao: row.observacao ? row.observacao.trim() : null,
    timestamp: row.timestamp,
  }));
}
