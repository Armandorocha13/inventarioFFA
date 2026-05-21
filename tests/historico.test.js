import { describe, it, expect, beforeEach } from 'vitest';
import {
  adicionarRegistro,
  getHistorico,
  limparHistorico,
  getRegistrosPorItem,
  getResumoContagem,
} from '../js/historico.js';

beforeEach(() => {
  limparHistorico();
});

describe('adicionarRegistro', () => {
  it('deve adicionar um registro ao histórico', () => {
    adicionarRegistro({ id: '1', descricao: 'CABO', valorAnterior: 100, valorNovo: 110 });
    expect(getHistorico()).toHaveLength(1);
  });

  it('deve incluir timestamp automático (ISO string)', () => {
    adicionarRegistro({ id: '1', descricao: 'CABO', valorAnterior: 10, valorNovo: 20 });
    const reg = getHistorico()[0];
    expect(reg).toHaveProperty('timestamp');
    expect(isNaN(Date.parse(reg.timestamp))).toBe(false);
  });

  it('deve incluir os dados enviados no registro', () => {
    adicionarRegistro({
      id: '2',
      descricao: 'PARAFUSO',
      valorAnterior: 50,
      valorNovo: 60,
      observacao: 'Recontagem solicitada',
    });
    const reg = getHistorico()[0];
    expect(reg.id).toBe('2');
    expect(reg.descricao).toBe('PARAFUSO');
    expect(reg.valorAnterior).toBe(50);
    expect(reg.valorNovo).toBe(60);
    expect(reg.observacao).toBe('Recontagem solicitada');
  });

  it('deve armazenar múltiplos registros', () => {
    adicionarRegistro({ id: '1', descricao: 'CABO', valorAnterior: 10, valorNovo: 20 });
    adicionarRegistro({ id: '2', descricao: 'LUVA', valorAnterior: 5, valorNovo: 8 });
    expect(getHistorico()).toHaveLength(2);
  });

  it('deve aceitar registro sem observação (observação undefined/null é ok)', () => {
    expect(() =>
      adicionarRegistro({ id: '1', descricao: 'X', valorAnterior: 0, valorNovo: 1 })
    ).not.toThrow();
  });

  it('deve lançar erro se faltar id', () => {
    expect(() =>
      adicionarRegistro({ descricao: 'SEM ID', valorAnterior: 0, valorNovo: 1 })
    ).toThrow();
  });

  it('deve lançar erro se valorNovo não for número', () => {
    expect(() =>
      adicionarRegistro({ id: '1', descricao: 'X', valorAnterior: 0, valorNovo: 'abc' })
    ).toThrow();
  });
});

describe('getHistorico', () => {
  it('deve retornar array vazio antes de qualquer registro', () => {
    expect(getHistorico()).toEqual([]);
  });

  it('deve retornar uma cópia do histórico, não a referência interna', () => {
    adicionarRegistro({ id: '1', descricao: 'X', valorAnterior: 0, valorNovo: 5 });
    const h1 = getHistorico();
    h1.push({ fake: true });
    expect(getHistorico()).toHaveLength(1); 
  });

  it('deve retornar registros na ordem de inserção (mais antigo primeiro)', () => {
    adicionarRegistro({ id: '1', descricao: 'A', valorAnterior: 0, valorNovo: 1 });
    adicionarRegistro({ id: '2', descricao: 'B', valorAnterior: 0, valorNovo: 2 });
    const h = getHistorico();
    expect(h[0].id).toBe('1');
    expect(h[1].id).toBe('2');
  });
});

describe('limparHistorico', () => {
  it('deve esvaziar o histórico', () => {
    adicionarRegistro({ id: '1', descricao: 'X', valorAnterior: 0, valorNovo: 1 });
    limparHistorico();
    expect(getHistorico()).toHaveLength(0);
  });
});

describe('getRegistrosPorItem', () => {
  beforeEach(() => {
    adicionarRegistro({ id: 'A', descricao: 'ITEM A', valorAnterior: 10, valorNovo: 20 });
    adicionarRegistro({ id: 'B', descricao: 'ITEM B', valorAnterior: 5, valorNovo: 8 });
    adicionarRegistro({ id: 'A', descricao: 'ITEM A', valorAnterior: 20, valorNovo: 30 });
  });

  it('deve retornar somente os registros do item solicitado', () => {
    const registros = getRegistrosPorItem('A');
    expect(registros).toHaveLength(2);
    registros.forEach(r => expect(r.id).toBe('A'));
  });

  it('deve retornar array vazio para id que não existe', () => {
    expect(getRegistrosPorItem('INEXISTENTE')).toHaveLength(0);
  });
});

describe('getResumoContagem', () => {
  beforeEach(() => {
    adicionarRegistro({ id: '1', descricao: 'A', valorAnterior: 10, valorNovo: 20 });
    adicionarRegistro({ id: '2', descricao: 'B', valorAnterior: 5, valorNovo: 5 }); 
    adicionarRegistro({ id: '3', descricao: 'C', valorAnterior: 50, valorNovo: 30 }); 
  });

  it('deve retornar o total de itens contados', () => {
    const r = getResumoContagem();
    expect(r.totalContados).toBe(3);
  });

  it('deve contar quantos itens tiveram divergência (valorNovo !== valorAnterior)', () => {
    const r = getResumoContagem();
    expect(r.totalDivergencias).toBe(2); 
  });

  it('deve retornar zeros quando histórico vazio', () => {
    limparHistorico();
    const r = getResumoContagem();
    expect(r.totalContados).toBe(0);
    expect(r.totalDivergencias).toBe(0);
  });
});
