import { describe, it, expect } from 'vitest';
import { classificarCurvaABC } from '../lib/auxiliaresUI';
import type { Material } from '../lib/auxiliaresUI';

const sampleMaterial = (
  id: number,
  codmat: string,
  saldoAtual: number,
  precoUnitario: number,
  classeABC: string
): Material => ({
  id,
  origem: 'SÃO PAULO',
  grupo: `Grupo ${id}`,
  codmat,
  descricao: `Item ${codmat}`,
  unidade: 'UN',
  saldoAtual,
  precoUnitario,
  ultimaAtualizacao: '2026-06-15',
  classeABC,
});

describe('classificarCurvaABC de-duplication', () => {
  it('should de-duplicate by codmat, keeping only the highest valorEstoque item', () => {
    const materiais: Material[] = [
      // codmat '123' duplicated in different groups:
      // Item 1: value = 10 * 10 = 100, Class C
      sampleMaterial(1, '123', 10, 10, 'C'),
      // Item 2: value = 50 * 10 = 500, Class A (Winner!)
      sampleMaterial(2, '123', 50, 10, 'A'),
      // Item 3: value = 20 * 10 = 200, Class B
      sampleMaterial(3, '123', 20, 10, 'B'),

      // codmat '456' not duplicated:
      // Item 4: value = 5 * 10 = 50, Class C
      sampleMaterial(4, '456', 5, 10, 'C'),
    ];

    const result = classificarCurvaABC(materiais);

    // Classes should only contain:
    // A: Item 2 (winner of '123')
    // B: Empty
    // C: Item 4 ('456')
    expect(result.classes.A).toHaveLength(1);
    expect(result.classes.A[0].id).toBe(2);

    expect(result.classes.B).toHaveLength(0);

    expect(result.classes.C).toHaveLength(1);
    expect(result.classes.C[0].id).toBe(4);

    // valorTotalEstoque should still sum ALL items (100 + 500 + 200 + 50 = 850)
    expect(result.valorTotalEstoque).toBe(850);
  });
});
