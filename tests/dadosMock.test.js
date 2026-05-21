import { describe, it, expect } from 'vitest';
import {
  getEstados,
  getAlmoxarifados,
  getMateriais,
  getTodasUFs,
} from '../js/dadosMock.js';

describe('getEstados', () => {
  it('deve retornar um array com ao menos um estado', () => {
    const estados = getEstados();
    expect(Array.isArray(estados)).toBe(true);
    expect(estados.length).toBeGreaterThan(0);
  });

  it('cada estado deve ter sigla e nome', () => {
    const estados = getEstados();
    estados.forEach(e => {
      expect(e).toHaveProperty('sigla');
      expect(e).toHaveProperty('nome');
      expect(typeof e.sigla).toBe('string');
      expect(typeof e.nome).toBe('string');
    });
  });

  it('deve conter RJ e ES', () => {
    const siglas = getEstados().map(e => e.sigla);
    expect(siglas).toContain('RJ');
    expect(siglas).toContain('ES');
  });
});

describe('getAlmoxarifados', () => {
  it('deve retornar almoxarifados para UF válida (RJ)', () => {
    const lista = getAlmoxarifados('RJ');
    expect(Array.isArray(lista)).toBe(true);
    expect(lista.length).toBeGreaterThan(0);
  });

  it('deve retornar almoxarifados para UF válida (ES)', () => {
    const lista = getAlmoxarifados('ES');
    expect(Array.isArray(lista)).toBe(true);
    expect(lista.length).toBeGreaterThan(0);
  });

  it('deve retornar array vazio para UF inválida', () => {
    const lista = getAlmoxarifados('XX');
    expect(lista).toEqual([]);
  });

  it('deve retornar array vazio para UF vazia', () => {
    const lista = getAlmoxarifados('');
    expect(lista).toEqual([]);
  });

  it('cada almoxarifado deve ter código e label', () => {
    const lista = getAlmoxarifados('RJ');
    lista.forEach(a => {
      expect(a).toHaveProperty('codigo');
      expect(a).toHaveProperty('label');
    });
  });
});

describe('getMateriais', () => {
  it('deve retornar array de materiais para almoxarifado válido', () => {
    const almoxs = getAlmoxarifados('RJ');
    const materiais = getMateriais(almoxs[0].codigo);
    expect(Array.isArray(materiais)).toBe(true);
    expect(materiais.length).toBeGreaterThan(0);
  });

  it('deve retornar array vazio para almoxarifado inválido', () => {
    const materiais = getMateriais('INVALIDO');
    expect(materiais).toEqual([]);
  });

  it('deve retornar array vazio para código vazio', () => {
    const materiais = getMateriais('');
    expect(materiais).toEqual([]);
  });

  it('cada material deve ter as propriedades obrigatórias', () => {
    const almoxs = getAlmoxarifados('RJ');
    const materiais = getMateriais(almoxs[0].codigo);
    materiais.forEach(m => {
      expect(m).toHaveProperty('id');
      expect(m).toHaveProperty('origem');
      expect(m).toHaveProperty('descricao');
      expect(m).toHaveProperty('unidade');
      expect(m).toHaveProperty('saldoAtual');
      expect(m).toHaveProperty('ultimaAtualizacao');
    });
  });

  it('saldoAtual deve ser número não-negativo', () => {
    const almoxs = getAlmoxarifados('RJ');
    const materiais = getMateriais(almoxs[0].codigo);
    materiais.forEach(m => {
      expect(typeof m.saldoAtual).toBe('number');
      expect(m.saldoAtual).toBeGreaterThanOrEqual(0);
    });
  });

  it('cada material deve ter id único dentro do mesmo almoxarifado', () => {
    const almoxs = getAlmoxarifados('RJ');
    const materiais = getMateriais(almoxs[0].codigo);
    const ids = materiais.map(m => m.id);
    const unicos = new Set(ids);
    expect(unicos.size).toBe(ids.length);
  });

  it('ultimaAtualizacao deve ser uma string de data válida ou null', () => {
    const almoxs = getAlmoxarifados('RJ');
    const materiais = getMateriais(almoxs[0].codigo);
    materiais.forEach(m => {
      if (m.ultimaAtualizacao !== null) {
        expect(typeof m.ultimaAtualizacao).toBe('string');
        expect(isNaN(Date.parse(m.ultimaAtualizacao))).toBe(false);
      }
    });
  });
});

describe('getTodasUFs', () => {
  it('deve retornar array de strings', () => {
    const ufs = getTodasUFs();
    expect(Array.isArray(ufs)).toBe(true);
    ufs.forEach(uf => expect(typeof uf).toBe('string'));
  });
});
