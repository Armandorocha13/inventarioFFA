import { describe, it, expect, beforeEach } from 'vitest';
import {
  getEstados,
  getAlmoxarifados,
  getMateriais,
  getTodasUFs,
  setFonteDados,
} from '../js/dadosFonte.js';

const fonteExemplo = {
  estados: [
    { sigla: 'RJ', nome: 'Rio de Janeiro' },
    { sigla: 'ES', nome: 'Espírito Santo' },
  ],
  almoxarifados: {
    RJ: [{ codigo: 'RJO', label: 'RJO — Rio de Janeiro' }],
    ES: [{ codigo: 'VVA', label: 'VVA — Vila Velha' }],
  },
  materiais: {
    RJO: [
      {
        id: 'RJO-001',
        origem: 'RJO',
        descricao: 'CABO DE FORÇA 10MM',
        unidade: 'M',
        saldoAtual: 10,
        ultimaAtualizacao: '2025-01-10',
      },
    ],
  },
};

describe('dadosFonte', () => {
  beforeEach(() => {
    setFonteDados(fonteExemplo);
  });

  it('deve retornar um array de estados configurados', () => {
    const estados = getEstados();
    expect(Array.isArray(estados)).toBe(true);
    expect(estados.length).toBeGreaterThan(0);
    expect(estados[0]).toHaveProperty('sigla');
    expect(estados[0]).toHaveProperty('nome');
  });

  it('getTodasUFs deve retornar as siglas dos estados', () => {
    const ufs = getTodasUFs();
    expect(ufs).toContain('RJ');
    expect(ufs).toContain('ES');
  });

  it('getAlmoxarifados deve retornar lista para UF válida e vazio para inválida', () => {
    expect(getAlmoxarifados('RJ').length).toBeGreaterThan(0);
    expect(getAlmoxarifados('XX')).toEqual([]);
  });

  it('getMateriais deve retornar lista para almoxarifado válido', () => {
    const materiais = getMateriais('RJO');
    expect(Array.isArray(materiais)).toBe(true);
    expect(materiais.length).toBeGreaterThan(0);
  });

  it('getMateriais deve retornar cópias (imutável externamente)', () => {
    const materiais = getMateriais('RJO');
    materiais[0].descricao = 'ALTERADO';
    const materiais2 = getMateriais('RJO');
    expect(materiais2[0].descricao).toBe('CABO DE FORÇA 10MM');
  });

  it('deve retornar arrays vazios quando não há fonte configurada', () => {
    setFonteDados(null);
    expect(getEstados()).toEqual([]);
    expect(getAlmoxarifados('RJ')).toEqual([]);
    expect(getMateriais('RJO')).toEqual([]);
  });
});
