/**
 * Gravação de contagens físicas.
 *
 * Fase A — preserva comportamento atual: upsert em `progresso_contagem` +
 * update em `saldo_estoque.saldo_disponivel`, com PILOT LOCK em RJ.
 *
 * Fase B — passará a inserir em `historico_contagem` (tabela ainda
 * inexistente no banco atual) e remover o PILOT LOCK.
 */
import { db } from '@/lib/db';
import type { ContagemInput } from '@/lib/domain/types';

export class ContagemInvalidaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContagemInvalidaError';
  }
}

function normalizar(item: ContagemInput): ContagemInput | null {
  if (!item || typeof item !== 'object') return null;
  if (!item.codmat) return null;
  const valorNovo = Number(item.valorNovo);
  if (!Number.isFinite(valorNovo)) return null;
  return {
    ...item,
    valorNovo,
    valorAnterior: item.valorAnterior != null ? Number(item.valorAnterior) : null,
    origem: (item.origem || '').trim(),
    grupo: (item.grupo || 'GERAL').trim(),
    observacao: item.observacao ?? '',
  };
}

// PILOT TEST LOCK — preservado da implementação original. Será removido
// quando o banco for recriado (Fase B).
const PILOT_LOCK_ORIGEM = 'RIO DE JANEIRO';

export async function gravarContagens(payload: unknown): Promise<{ count: number }> {
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new ContagemInvalidaError('Corpo da requisição deve ser um array não vazio de contagens.');
  }

  const itens = payload
    .map((item) => normalizar(item as ContagemInput))
    .filter((x): x is ContagemInput => x !== null);

  return db.transaction(async (tx) => {
    let gravadas = 0;
    for (const item of itens) {
      if ((item.origem || '').toUpperCase() !== PILOT_LOCK_ORIGEM) continue;

      await tx.query(
        `INSERT INTO progresso_contagem (cidade, grupo, codmat, quantidade_contada)
              VALUES ($1, $2, $3, $4)
         ON CONFLICT (cidade, grupo, codmat) DO UPDATE
              SET quantidade_contada = EXCLUDED.quantidade_contada,
                  atualizado_em = CURRENT_TIMESTAMP`,
        [item.origem || 'ND', item.grupo || 'GERAL', item.codmat, item.valorNovo]
      );

      await tx.query(
        `UPDATE saldo_estoque SET saldo_disponivel = $1 WHERE id = $2`,
        [item.valorNovo, item.id]
      );
      gravadas++;
    }
    return { count: gravadas };
  });
}
