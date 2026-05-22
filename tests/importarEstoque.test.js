import { describe, it, expect } from 'vitest';
import {
  parseNumeric,
  mapearCabecalhos,
  filtrarEProcessarDados,
  detectarColunasAtivas,
  processarDePara,
} from '../js/auxiliaresImportacao.js';

describe('parseNumeric', () => {
  it('deve converter inteiros e decimais com ponto ou vírgula', () => {
    expect(parseNumeric(123)).toBe(123);
    expect(parseNumeric('123.45')).toBe(123.45);
    expect(parseNumeric('123,45')).toBe(123.45);
  });

  it('deve retornar 0 para valores vazios, nulos ou indefinidos', () => {
    expect(parseNumeric('')).toBe(0);
    expect(parseNumeric('   ')).toBe(0);
    expect(parseNumeric(null)).toBe(0);
    expect(parseNumeric(undefined)).toBe(0);
  });

  it('deve retornar 0 para strings não numéricas', () => {
    expect(parseNumeric('abc')).toBe(0);
  });
});

describe('mapearCabecalhos', () => {
  const mapping = {
    'Tipo Saldo': 'tipo_saldo',
    'Codmat': 'codmat',
    'Descrição': 'descricao'
  };

  it('deve mapear corretamente os índices das colunas encontradas', () => {
    const rawHeaders = ['Tipo Saldo', 'Grupo', 'Codmat', 'Descrição'];
    const resultado = mapearCabecalhos(rawHeaders, mapping);

    expect(resultado).toEqual({
      tipo_saldo: 0,
      codmat: 2,
      descricao: 3
    });
  });

  it('deve ignorar colunas não presentes no mapeamento', () => {
    const rawHeaders = ['Outra Coluna', 'Grupo', 'Inexistente'];
    const resultado = mapearCabecalhos(rawHeaders, mapping);

    expect(resultado).toEqual({});
  });
});

describe('filtrarEProcessarDados', () => {
  const headerMapping = {
    'Tipo Saldo': 'tipo_saldo',
    'Codmat': 'codmat',
    'Descrição': 'descricao',
    'Saldo em Estoque': 'saldo_estoque'
  };
  const dbColumns = ['tipo_saldo', 'codmat', 'descricao', 'saldo_estoque'];

  it('deve ignorar a primeira linha de título e filtrar linhas onde Codmat inicia com 1000', () => {
    const mockRows = [
      // Linha 1: Título (ignorado)
      ['LOCALIZAÇÃO DO SALDO DE MATERIAL'],
      // Linha 2: Cabeçalhos reais
      ['Tipo Saldo', 'Codmat', 'Descrição', 'Saldo em Estoque'],
      // Linha 3: Dado válido (começa com 1000)
      ['PROJETO', '10004567', 'Material A', '150,5'],
      // Linha 4: Dado inválido (não começa com 1000)
      ['PROJETO', 'R41001288', 'Material B', '100'],
      // Linha 5: Dado válido (começa com 1000 numérico no Excel)
      ['PROJETO', 10009999, 'Material C', 200]
    ];

    const resultado = filtrarEProcessarDados(mockRows, headerMapping, dbColumns);

    expect(resultado).toHaveLength(2);
    
    // Validando primeiro item correspondente
    expect(resultado[0]).toEqual({
      tipo_saldo: 'PROJETO',
      codmat: '10004567',
      descricao: 'Material A',
      saldo_estoque: 150.5
    });

    // Validando segundo item correspondente (conversão de tipo numérico para string no codmat)
    expect(resultado[1]).toEqual({
      tipo_saldo: 'PROJETO',
      codmat: '10009999',
      descricao: 'Material C',
      saldo_estoque: 200
    });
  });

  it('deve retornar array vazio se nenhuma linha corresponder ao filtro', () => {
    const mockRows = [
      ['LOCALIZAÇÃO DO SALDO DE MATERIAL'],
      ['Tipo Saldo', 'Codmat', 'Descrição', 'Saldo em Estoque'],
      ['PROJETO', '20004567', 'Material A', '150'],
      ['PROJETO', 'R41001288', 'Material B', '100']
    ];

    const resultado = filtrarEProcessarDados(mockRows, headerMapping, dbColumns);
    expect(resultado).toHaveLength(0);
  });

  it('deve dividir a coluna Grupo em grupo_codigo e grupo quando ambos estiverem no dbColumns', () => {
    const customMapping = {
      'Codmat': 'codmat',
      'Grupo': 'grupo'
    };
    const customDbColumns = ['codmat', 'grupo_codigo', 'grupo'];
    
    const mockRows = [
      ['LOCALIZAÇÃO DO SALDO DE MATERIAL'],
      ['Codmat', 'Grupo'],
      ['10004567', '02/REGULADOR CLARO INST'],
      ['10009999', 'APENAS_TEXTO_SEM_BARRA'],
      ['10001234', null]
    ];

    const resultado = filtrarEProcessarDados(mockRows, customMapping, customDbColumns);

    expect(resultado).toHaveLength(3);
    
    expect(resultado[0]).toEqual({
      codmat: '10004567',
      grupo_codigo: '02',
      grupo: 'REGULADOR CLARO INST'
    });

    expect(resultado[1]).toEqual({
      codmat: '10009999',
      grupo_codigo: null,
      grupo: 'APENAS_TEXTO_SEM_BARRA'
    });

    expect(resultado[2]).toEqual({
      codmat: '10001234',
      grupo_codigo: null,
      grupo: null
    });
  });
});

describe('detectarColunasAtivas', () => {
  it('deve retornar apenas colunas que possuem alguma informação preenchida', () => {
    const colunasDisponiveis = ['col_a', 'col_b', 'col_c', 'col_d'];
    const mockDados = [
      { col_a: 'Valor A1', col_b: '', col_c: null, col_d: 0 },
      { col_a: null, col_b: '   ', col_c: undefined, col_d: null },
      { col_a: 'Valor A3', col_b: null, col_c: null, col_d: 15 }
    ];

    const colunasAtivas = detectarColunasAtivas(mockDados, colunasDisponiveis);

    // col_a tem valores ('Valor A1', 'Valor A3') -> Ativa
    // col_b tem apenas strings vazias ou de espaço -> Inativa
    // col_c tem apenas null/undefined -> Inativa
    // col_d tem valores (0, 15) -> Ativa
    expect(colunasAtivas).toEqual(['col_a', 'col_d']);
  });

  it('deve retornar array vazio se os dados forem vazios', () => {
    const colunasDisponiveis = ['col_a', 'col_b'];
    expect(detectarColunasAtivas([], colunasDisponiveis)).toEqual([]);
  });
});

describe('processarDePara', () => {
  const headerMapping = {
    'CONTRATO': 'contrato',
    'CIDADE': 'cidade',
    'PROJETO': 'projeto'
  };
  const dbColumns = ['contrato', 'cidade', 'projeto'];

  it('deve mapear os cabeçalhos a partir da primeira linha (index 0) e processar os dados corretamente', () => {
    const mockRows = [
      // Linha 1 (index 0): Cabeçalhos reais diretamente
      ['CONTRATO', 'CIDADE', 'PROJETO'],
      // Linha 2 (index 1): Registro válido
      [2, 'RIO DE JANEIRO', 'REGULADOR CLARO INST'],
      // Linha 3 (index 2): Registro válido com espaços extras
      ['36', '  SÃO PAULO  ', 'FTTC']
    ];

    const resultado = processarDePara(mockRows, headerMapping, dbColumns);

    expect(resultado).toHaveLength(2);
    expect(resultado[0]).toEqual({
      contrato: 2,
      cidade: 'RIO DE JANEIRO',
      projeto: 'REGULADOR CLARO INST'
    });
    expect(resultado[1]).toEqual({
      contrato: 36,
      cidade: 'SÃO PAULO',
      projeto: 'FTTC'
    });
  });

  it('deve lidar com campos em branco ou ausentes retornando null', () => {
    const mockRows = [
      ['CONTRATO', 'CIDADE', 'PROJETO'],
      [null, 'RIO DE JANEIRO', 'FTTH'],
      [40, '', null]
    ];

    const resultado = processarDePara(mockRows, headerMapping, dbColumns);

    expect(resultado).toHaveLength(2);
    expect(resultado[0].contrato).toBe(0); // parseNumeric de null é 0
    expect(resultado[0].cidade).toBe('RIO DE JANEIRO');
    expect(resultado[0].projeto).toBe('FTTH');

    expect(resultado[1].contrato).toBe(40);
    expect(resultado[1].cidade).toBe(null);
    expect(resultado[1].projeto).toBe(null);
  });
});

