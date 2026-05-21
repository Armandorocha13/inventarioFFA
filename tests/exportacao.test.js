import { describe, it, expect } from 'vitest';
import {
  prepararDadosExport,
  gerarNomeArquivo,
} from '../js/exportacao.js';

const materiais = [
  { id: '1', origem: 'RJO', descricao: 'CABO DE FORÇA 10MM', unidade: 'M', saldoAtual: 100, ultimaAtualizacao: '2025-01-15' },
  { id: '2', origem: 'RJO', descricao: 'PARAFUSO SEXTAVADO M8', unidade: 'UN', saldoAtual: 0, ultimaAtualizacao: '2025-03-10' },
  { id: '3', origem: 'VRD', descricao: 'LUVA DE COMPRESSÃO', unidade: 'PC', saldoAtual: 50, ultimaAtualizacao: null },
];

const contagens = [
  { id: '1', novaQtd: 110, observacao: 'Recontagem OK' },
  { id: '3', novaQtd: 48, observacao: '' },
];

describe('prepararDadosExport', () => {
  it('deve retornar um array de linhas', () => {
    const linhas = prepararDadosExport(materiais, contagens);
    expect(Array.isArray(linhas)).toBe(true);
  });

  it('deve ter o mesmo número de linhas que materiais (header não incluso)', () => {
    const linhas = prepararDadosExport(materiais, contagens);
    expect(linhas).toHaveLength(materiais.length);
  });

  it('cada linha deve ter as colunas esperadas', () => {
    const linhas = prepararDadosExport(materiais, contagens);
    const colunas = ['Origem', 'Descrição', 'Unidade', 'Saldo Anterior', 'Nova Contagem', 'Divergência', 'Observação', 'Data Contagem'];
    linhas.forEach(linha => {
      colunas.forEach(col => {
        expect(linha).toHaveProperty(col);
      });
    });
  });

  it('deve preencher Nova Contagem com o valor da contagem quando disponível', () => {
    const linhas = prepararDadosExport(materiais, contagens);
    const linha1 = linhas.find(l => l['Origem'] === 'RJO' && l['Descrição'] === 'CABO DE FORÇA 10MM');
    expect(linha1['Nova Contagem']).toBe(110);
  });

  it('deve deixar Nova Contagem vazio (ou null) quando item não foi contado', () => {
    const linhas = prepararDadosExport(materiais, contagens);
    const linha2 = linhas.find(l => l['Descrição'] === 'PARAFUSO SEXTAVADO M8');
    expect(linha2['Nova Contagem'] === null || linha2['Nova Contagem'] === '' || linha2['Nova Contagem'] === undefined).toBe(true);
  });

  it('deve calcular divergência como (novaQtd - saldoAtual) quando contado', () => {
    const linhas = prepararDadosExport(materiais, contagens);
    const linha1 = linhas.find(l => l['Descrição'] === 'CABO DE FORÇA 10MM');
    expect(linha1['Divergência']).toBe(10); 
  });

  it('deve deixar divergência vazio quando item não foi contado', () => {
    const linhas = prepararDadosExport(materiais, contagens);
    const linha2 = linhas.find(l => l['Descrição'] === 'PARAFUSO SEXTAVADO M8');
    expect(linha2['Divergência'] === null || linha2['Divergência'] === '' || linha2['Divergência'] === undefined).toBe(true);
  });

  it('deve incluir a observação quando disponível', () => {
    const linhas = prepararDadosExport(materiais, contagens);
    const linha1 = linhas.find(l => l['Descrição'] === 'CABO DE FORÇA 10MM');
    expect(linha1['Observação']).toBe('Recontagem OK');
  });

  it('deve retornar array vazio para lista de materiais vazia', () => {
    expect(prepararDadosExport([], [])).toHaveLength(0);
  });

  it('não deve conter campos com elementos HTML (sem <input>, <td>, etc.)', () => {
    const linhas = prepararDadosExport(materiais, contagens);
    const json = JSON.stringify(linhas);
    expect(json).not.toMatch(/<input/i);
    expect(json).not.toMatch(/<td/i);
    expect(json).not.toMatch(/<tr/i);
  });

  it('deve incluir Data Contagem como string de data quando item foi contado', () => {
    const linhas = prepararDadosExport(materiais, contagens);
    const linha1 = linhas.find(l => l['Descrição'] === 'CABO DE FORÇA 10MM');
    expect(typeof linha1['Data Contagem']).toBe('string');
    expect(linha1['Data Contagem'].length).toBeGreaterThan(0);
  });
});

describe('gerarNomeArquivo', () => {
  it('deve retornar string com extensão .xlsx', () => {
    const nome = gerarNomeArquivo('RJO');
    expect(nome.endsWith('.xlsx')).toBe(true);
  });

  it('deve incluir o código do almoxarifado no nome', () => {
    const nome = gerarNomeArquivo('VRD');
    expect(nome).toContain('VRD');
  });

  it('deve incluir a data atual no nome', () => {
    const nome = gerarNomeArquivo('RJO');
    const ano = new Date().getFullYear().toString();
    expect(nome).toContain(ano);
  });

  it('deve substituir barras "/" por hífens no nome (sem caracteres inválidos)', () => {
    const nome = gerarNomeArquivo('RJO');
    expect(nome).not.toContain('/');
  });
});
