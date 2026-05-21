import { describe, it, expect } from 'vitest';
import {
  filtrarMateriais,
  ordenarPor,
  debounce,
} from '../js/filtros.js';

const materiais = [
  { id: '1', origem: 'RJO', descricao: 'CABO DE FORÇA 10MM', unidade: 'M', saldoAtual: 100, ultimaAtualizacao: '2025-01-15' },
  { id: '2', origem: 'RJO', descricao: 'PARAFUSO SEXTAVADO M8', unidade: 'UN', saldoAtual: 0, ultimaAtualizacao: '2025-03-10' },
  { id: '3', origem: 'VRD', descricao: 'LUVA DE COMPRESSÃO', unidade: 'PC', saldoAtual: 50, ultimaAtualizacao: '2024-12-01' },
  { id: '4', origem: 'CPS', descricao: 'FITA ISOLANTE PRETA', unidade: 'RL', saldoAtual: 200, ultimaAtualizacao: null },
];

describe('filtrarMateriais', () => {
  it('deve retornar todos os itens quando o termo é vazio', () => {
    expect(filtrarMateriais(materiais, '')).toHaveLength(4);
  });

  it('deve filtrar pela descrição (case insensitive)', () => {
    const resultado = filtrarMateriais(materiais, 'cabo');
    expect(resultado).toHaveLength(1);
    expect(resultado[0].id).toBe('1');
  });

  it('deve filtrar pela origem (case insensitive)', () => {
    const resultado = filtrarMateriais(materiais, 'vrd');
    expect(resultado).toHaveLength(1);
    expect(resultado[0].id).toBe('3');
  });

  it('deve filtrar por termos parciais na descrição', () => {
    const resultado = filtrarMateriais(materiais, 'luva');
    expect(resultado).toHaveLength(1);
  });

  it('deve retornar array vazio quando nenhum item corresponde', () => {
    const resultado = filtrarMateriais(materiais, 'xyzxyz');
    expect(resultado).toHaveLength(0);
  });

  it('deve retornar múltiplos resultados quando mais de um item corresponde', () => {
    const resultado = filtrarMateriais(materiais, 'RJO');
    expect(resultado).toHaveLength(2);
  });

  it('deve retornar array vazio para lista vazia', () => {
    expect(filtrarMateriais([], 'cabo')).toHaveLength(0);
  });

  it('não deve modificar o array original', () => {
    const original = [...materiais];
    filtrarMateriais(materiais, 'cabo');
    expect(materiais).toHaveLength(original.length);
  });

  it('deve filtrar apenas materiais com divergências registradas se apenasDivergentes = true', () => {
    const contagens = {
      '1': { novaQtd: 90 },  // divergente (saldoAtual era 100)
      '2': { novaQtd: 0 },   // igual ao saldo (saldoAtual era 0)
      '3': { novaQtd: 50 }   // igual ao saldo (saldoAtual era 50)
      // '4' não foi contado (não é divergente ativo)
    };
    const resultado = filtrarMateriais(materiais, '', contagens, true);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].id).toBe('1');
  });
});

describe('ordenarPor', () => {
  it('deve ordenar por descrição em ordem ascendente', () => {
    const resultado = ordenarPor(materiais, 'descricao', 'asc');
    expect(resultado[0].descricao <= resultado[1].descricao).toBe(true);
    expect(resultado[1].descricao <= resultado[2].descricao).toBe(true);
  });

  it('deve ordenar por descrição em ordem descendente', () => {
    const resultado = ordenarPor(materiais, 'descricao', 'desc');
    expect(resultado[0].descricao >= resultado[1].descricao).toBe(true);
  });

  it('deve ordenar por saldoAtual (número) em ordem ascendente', () => {
    const resultado = ordenarPor(materiais, 'saldoAtual', 'asc');
    expect(resultado[0].saldoAtual).toBe(0);
    expect(resultado[resultado.length - 1].saldoAtual).toBe(200);
  });

  it('deve ordenar por saldoAtual (número) em ordem descendente', () => {
    const resultado = ordenarPor(materiais, 'saldoAtual', 'desc');
    expect(resultado[0].saldoAtual).toBe(200);
    expect(resultado[resultado.length - 1].saldoAtual).toBe(0);
  });

  it('não deve modificar o array original', () => {
    const copia = [...materiais];
    ordenarPor(materiais, 'descricao', 'asc');
    expect(materiais.map(m => m.id)).toEqual(copia.map(m => m.id));
  });

  it('deve retornar array vazio para lista vazia', () => {
    expect(ordenarPor([], 'descricao', 'asc')).toHaveLength(0);
  });

  it('deve lidar com valores null na coluna (null vai para o final)', () => {
    const resultado = ordenarPor(materiais, 'ultimaAtualizacao', 'asc');
    expect(resultado[resultado.length - 1].ultimaAtualizacao).toBeNull();
  });
});

describe('debounce', () => {
  it('deve chamar a função apenas uma vez após o delay', async () => {
    let chamadas = 0;
    const fn = debounce(() => chamadas++, 50);

    fn();
    fn();
    fn();

    await new Promise(r => setTimeout(r, 100));
    expect(chamadas).toBe(1);
  });

  it('deve passar os argumentos corretamente para a função original', async () => {
    let resultado = null;
    const fn = debounce((a, b) => { resultado = a + b; }, 30);

    fn(3, 7);
    await new Promise(r => setTimeout(r, 60));
    expect(resultado).toBe(10);
  });

  it('deve reiniciar o timer a cada chamada', async () => {
    let chamadas = 0;
    const fn = debounce(() => chamadas++, 80);

    fn();
    await new Promise(r => setTimeout(r, 50));
    fn();
    await new Promise(r => setTimeout(r, 100));

    expect(chamadas).toBe(1);
  });
});
