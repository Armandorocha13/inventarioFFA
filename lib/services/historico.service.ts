/**
 * Consulta do histórico de contagens, lendo da tabela de auditoria
 * `historico_contagem` (mais recentes primeiro).
 */
import { db } from '@/lib/db';
import type { HistoricoRegistro } from '@/lib/domain/types';

interface HistoricoRow {
  id: number;
  codmat: string | null;
  descricao: string | null;
  valor_anterior: string | number | null;
  valor_novo: string | number | null;
  desvio: string | number | null;
  observacao: string | null;
  timestamp: string;
}

export async function listarHistorico(): Promise<HistoricoRegistro[]> {
  const { rows } = await db.query<HistoricoRow>(
    `SELECT id, codmat, descricao, valor_anterior, valor_novo, desvio, observacao, timestamp
       FROM historico_contagem
      ORDER BY timestamp DESC, id DESC
      LIMIT 100`
  );

  return rows.map((row) => ({
    id: row.id,
    codmat: row.codmat ? row.codmat.trim() : '',
    descricao: row.descricao ? row.descricao.trim() : '',
    valorAnterior: row.valor_anterior != null ? parseFloat(String(row.valor_anterior)) : null,
    valorNovo: row.valor_novo != null ? parseFloat(String(row.valor_novo)) : 0,
    desvio: row.desvio != null ? parseFloat(String(row.desvio)) : 0,
    observacao: row.observacao ? row.observacao.trim() : null,
    timestamp: row.timestamp,
  }));
}
