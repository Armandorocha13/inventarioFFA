import { describe, it, expect } from 'vitest';
import { calcularAcuracidade } from '../lib/auxiliaresUI';
import type { Material, ContagensMap } from '../lib/auxiliaresUI';

const sampleMaterial = (id: number, saldoAtual: number): Material => ({
  id,
  origem: 'SÃO PAULO',
  codmat: `${100 + id}`,
  descricao: `Item ${id}`,
  unidade: 'UN',
  saldoAtual,
  precoUnitario: 10,
  ultimaAtualizacao: '2026-06-08',
}); 

describe('calcularAcuracidade', () => {
  it('should return 100% accuracy when all counted items match perfectly', () => {
    const materiais = [
      sampleMaterial(1, 10),
      sampleMaterial(2, 20),
    ];
    const contagens: ContagensMap = {
      1: { novaQtd: 10, observacao: '' },
      2: { novaQtd: 20, observacao: '' },
    };

    const stats = calcularAcuracidade(materiais, contagens);
    expect(stats.taxaAcuracidade).toBe(100);
    expect(stats.acertos).toBe(2);
    expect(stats.divergentes).toBe(0);
    expect(stats.contados).toBe(2);
  });

  it('should return 0% accuracy when no counted items match perfectly (even if quantity is close)', () => {
    const materiais = [
      sampleMaterial(1, 10),
      sampleMaterial(2, 10),
    ];
    // Both are divergent, but system sums to 20 while physical sums to 12.
    // Old formula would give 60% accuracy, but new formula must return 0%.
    const contagens: ContagensMap = {
      1: { novaQtd: 6, observacao: '' },
      2: { novaQtd: 6, observacao: '' },
    };

    const stats = calcularAcuracidade(materiais, contagens);
    expect(stats.taxaAcuracidade).toBe(0);
    expect(stats.acertos).toBe(0);
    expect(stats.divergentes).toBe(2);
    expect(stats.contados).toBe(2);
  });

  it('should calculate correct exact-match accuracy for partial matches', () => {
    const materiais = [
      sampleMaterial(1, 10),
      sampleMaterial(2, 10),
      sampleMaterial(3, 10),
      sampleMaterial(4, 10),
    ];
    // 2 matching, 2 divergent
    const contagens: ContagensMap = {
      1: { novaQtd: 10, observacao: '' },
      2: { novaQtd: 10, observacao: '' },
      3: { novaQtd: 5, observacao: '' },
      4: { novaQtd: 20, observacao: '' },
    };

    const stats = calcularAcuracidade(materiais, contagens);
    expect(stats.taxaAcuracidade).toBe(50); // 2 out of 4 matching
    expect(stats.acertos).toBe(2);
    expect(stats.divergentes).toBe(2);
    expect(stats.contados).toBe(4);
  });

  it('should return 100% accuracy when no items are counted', () => {
    const materiais = [
      sampleMaterial(1, 10),
    ];
    const contagens: ContagensMap = {};

    const stats = calcularAcuracidade(materiais, contagens);
    expect(stats.taxaAcuracidade).toBe(100);
    expect(stats.contados).toBe(0);
  });
});
