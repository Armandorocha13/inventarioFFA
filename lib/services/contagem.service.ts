/**
 * Gravação de contagens físicas, em transação atômica:
 *   1. upsert em `progresso_contagem` (estado atual da contagem)
 *   2. update em `saldo_estoque.saldo_disponivel`
 *   3. insert em `historico_contagem` (auditoria — uma linha por item)
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

export async function gravarContagens(payload: unknown): Promise<{ count: number }> {
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new ContagemInvalidaError('Corpo da requisição deve ser um array não vazio de contagens.');
  }

  const itens = payload
    .map((item) => normalizar(item as ContagemInput))
    .filter((x): x is ContagemInput => x !== null);

  if (itens.length === 0) {
    throw new ContagemInvalidaError('Nenhuma contagem válida no payload.');
  }

  return db.transaction(async (tx) => {
    for (const item of itens) {
      const valorAnterior = item.valorAnterior ?? 0;
      const desvio = item.valorNovo - valorAnterior;

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

      await tx.query(
        `INSERT INTO historico_contagem
              (codmat, descricao, valor_anterior, valor_novo, desvio, observacao, origem, grupo)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          item.codmat,
          item.descricao || '',
          valorAnterior,
          item.valorNovo,
          desvio,
          item.observacao || null,
          item.origem || 'ND',
          item.grupo || 'GERAL',
        ]
      );
    }

    return { count: itens.length };
  });
}
