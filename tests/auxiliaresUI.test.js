import { describe, it, expect } from 'vitest';
import {
  formatarData,
  getBadgeClass,
  calcularProgresso,
  sanitizarTexto,
  truncarTexto,
  formatarMoeda,
  calcularAcuracidade,
  calcularFinanceiroDivergencias,
  classificarCurvaABC,
} from '../js/auxiliaresUI.js';

describe('formatarData', () => {
  it('deve formatar data ISO para dd/mm/aaaa', () => {
    expect(formatarData('2025-03-15')).toBe('15/03/2025');
  });

  it('deve retornar "Sem data" para null', () => {
    expect(formatarData(null)).toBe('Sem data');
  });

  it('deve retornar "Sem data" para undefined', () => {
    expect(formatarData(undefined)).toBe('Sem data');
  });

  it('deve retornar "Sem data" para string vazia', () => {
    expect(formatarData('')).toBe('Sem data');
  });

  it('deve lidar com formato ISO completo (com horário)', () => {
    const resultado = formatarData('2025-06-20T14:30:00.000Z');
    expect(resultado).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it('deve retornar "Data inválida" para string não-data', () => {
    expect(formatarData('nao-e-data')).toBe('Data inválida');
  });
});

describe('getBadgeClass', () => {
  it('deve retornar "badge-zero" para saldo 0', () => {
    expect(getBadgeClass(0)).toBe('badge-zero');
  });

  it('deve retornar "badge-low" para saldo entre 1 e 10 (inclusive)', () => {
    expect(getBadgeClass(1)).toBe('badge-low');
    expect(getBadgeClass(10)).toBe('badge-low');
  });

  it('deve retornar "badge-ok" para saldo acima de 10', () => {
    expect(getBadgeClass(11)).toBe('badge-ok');
    expect(getBadgeClass(999)).toBe('badge-ok');
  });

  it('deve retornar "badge-zero" para valores negativos (dado inválido)', () => {
    expect(getBadgeClass(-1)).toBe('badge-zero');
  });
});

describe('calcularProgresso', () => {
  const materiais = [
    { id: '1' }, { id: '2' }, { id: '3' }, { id: '4' },
  ];

  it('deve retornar 0% quando nenhum item foi contado', () => {
    const r = calcularProgresso(materiais, {});
    expect(r.percentual).toBe(0);
    expect(r.contados).toBe(0);
    expect(r.total).toBe(4);
  });

  it('deve retornar 100% quando todos os itens foram contados', () => {
    const contagens = { '1': 10, '2': 5, '3': 0, '4': 3 };
    const r = calcularProgresso(materiais, contagens);
    expect(r.percentual).toBe(100);
    expect(r.contados).toBe(4);
  });

  it('deve calcular percentual parcial corretamente', () => {
    const contagens = { '1': 10, '2': 5 }; 
    const r = calcularProgresso(materiais, contagens);
    expect(r.percentual).toBe(50);
    expect(r.contados).toBe(2);
  });

  it('deve arredondar o percentual para inteiro', () => {
    const materiais3 = [{ id: '1' }, { id: '2' }, { id: '3' }];
    const contagens = { '1': 10 }; 
    const r = calcularProgresso(materiais3, contagens);
    expect(Number.isInteger(r.percentual)).toBe(true);
    expect(r.percentual).toBe(33);
  });

  it('deve retornar 0% para lista de materiais vazia', () => {
    const r = calcularProgresso([], {});
    expect(r.percentual).toBe(0);
    expect(r.total).toBe(0);
  });

  it('deve contar item com valor 0 como contado', () => {
    const contagens = { '1': 0 }; 
    const r = calcularProgresso(materiais, contagens);
    expect(r.contados).toBe(1);
  });
});

describe('sanitizarTexto', () => {
  it('deve remover tags HTML da string', () => {
    expect(sanitizarTexto('<script>alert("xss")</script>')).not.toContain('<script>');
  });

  it('deve retornar string normal sem modificação', () => {
    expect(sanitizarTexto('Texto normal')).toBe('Texto normal');
  });

  it('deve retornar string vazia para null/undefined', () => {
    expect(sanitizarTexto(null)).toBe('');
    expect(sanitizarTexto(undefined)).toBe('');
  });

  it('deve converter entidades HTML perigosas', () => {
    const resultado = sanitizarTexto('<b>negrito</b>');
    expect(resultado).not.toContain('<b>');
  });
});

describe('truncarTexto', () => {
  it('deve não truncar texto menor que o limite', () => {
    expect(truncarTexto('curto', 10)).toBe('curto');
  });

  it('deve truncar texto e adicionar "..." quando excede o limite', () => {
    const resultado = truncarTexto('texto muito longo', 10);
    expect(resultado.endsWith('...')).toBe(true);
    expect(resultado.length).toBeLessThanOrEqual(13); 
  });

  it('deve respeitar exatamente o limite', () => {
    expect(truncarTexto('12345', 5)).toBe('12345');
  });

  it('deve retornar string vazia para null/undefined', () => {
    expect(truncarTexto(null, 10)).toBe('');
    expect(truncarTexto(undefined, 10)).toBe('');
  });
});

describe('formatarMoeda', () => {
  it('deve formatar valor numerico como BRL', () => {
    expect(formatarMoeda(10.5)).toContain('10,50');
    expect(formatarMoeda(1250.75)).toContain('1.250,75');
  });

  it('deve retornar "R$ 0,00" para valores vazios ou invalidos', () => {
    expect(formatarMoeda(null)).toBe('R$ 0,00');
    expect(formatarMoeda(undefined)).toBe('R$ 0,00');
    expect(formatarMoeda(NaN)).toBe('R$ 0,00');
  });
});

describe('calcularAcuracidade', () => {
  const materiais = [
    { id: '1', saldoAtual: 10 },
    { id: '2', saldoAtual: 20 },
    { id: '3', saldoAtual: 30 }
  ];

  it('deve retornar 100% quando nao houver contagens realizadas', () => {
    const r = calcularAcuracidade(materiais, {});
    expect(r.taxaAcuracidade).toBe(100);
    expect(r.contados).toBe(0);
  });

  it('deve calcular 100% de acuracidade quando tudo bater', () => {
    const contagens = {
      '1': { novaQtd: 10 },
      '2': { novaQtd: 20 }
    };
    const r = calcularAcuracidade(materiais, contagens);
    expect(r.taxaAcuracidade).toBe(100);
    expect(r.acertos).toBe(2);
    expect(r.divergentes).toBe(0);
  });

  it('deve calcular percentual de acuracidade parcial se houver divergencias', () => {
    const contagens = {
      '1': { novaQtd: 10 }, // certo
      '2': { novaQtd: 25 }, // errado (+5)
      '3': { novaQtd: 15 }  // errado (-15)
    };
    const r = calcularAcuracidade(materiais, contagens);
    expect(r.taxaAcuracidade).toBe(33); // 1 acerto de 3 contados
    expect(r.acertos).toBe(1);
    expect(r.divergentes).toBe(2);
  });

  it('deve retornar acuracidade 100 para lista de materiais vazia', () => {
    expect(calcularAcuracidade([], {}).taxaAcuracidade).toBe(100);
  });
});

describe('calcularFinanceiroDivergencias', () => {
  const materiais = [
    { id: '1', descricao: 'CABO', saldoAtual: 100, precoUnitario: 10 },
    { id: '2', descricao: 'TRANSFORMADOR', saldoAtual: 1, precoUnitario: 5000 },
    { id: '3', descricao: 'PARAFUSO', saldoAtual: 50, precoUnitario: 2 }
  ];

  it('deve retornar distorcao e resultado zerados se nao houver contagens', () => {
    const r = calcularFinanceiroDivergencias(materiais, {});
    expect(r.distorcaoPatrimonial).toBe(0);
    expect(r.resultadoLiquido).toBe(0);
    expect(r.detalhes.length).toBe(0);
  });

  it('deve calcular perdas e sobras financeiras corretamente', () => {
    const contagens = {
      '1': { novaQtd: 90 },  // falta 10 cabos (-10 * 10 = -100)
      '2': { novaQtd: 1 },   // sem divergencia
      '3': { novaQtd: 60 }   // sobra 10 parafusos (+10 * 2 = +20)
    };
    const r = calcularFinanceiroDivergencias(materiais, contagens);
    
    // Distorcao absoluta: |-100| + |20| = 120
    expect(r.distorcaoPatrimonial).toBe(120);
    // Resultado liquido: -100 + 20 = -80
    expect(r.resultadoLiquido).toBe(-80);
    expect(r.detalhes.length).toBe(2);
    
    const caboDet = r.detalhes.find(d => d.id === '1');
    expect(caboDet.desvio).toBe(-10);
    expect(caboDet.impacto).toBe(-100);
  });
});

describe('classificarCurvaABC', () => {
  const materiais = [
    { id: '1', saldoAtual: 2, precoUnitario: 4000 }, // R$ 8.000 (Item A - 80% do valor total de R$ 10.000)
    { id: '2', saldoAtual: 10, precoUnitario: 150 }, // R$ 1.500 (Item B - 15%)
    { id: '3', saldoAtual: 100, precoUnitario: 5 }   // R$ 500 (Item C - 5%)
  ];

  it('deve classificar materiais em A, B e C baseando-se no valor estocado', () => {
    const r = classificarCurvaABC(materiais, {});
    expect(r.valorTotalEstoque).toBe(10000);
    expect(r.classes.A.length).toBe(1);
    expect(r.classes.A[0].id).toBe('1');
    
    expect(r.classes.B.length).toBe(1);
    expect(r.classes.B[0].id).toBe('2');
    
    expect(r.classes.C.length).toBe(1);
    expect(r.classes.C[0].id).toBe('3');
  });

  it('deve lidar com caso onde todos os itens tem valor estocado zerado', () => {
    const materiaisZerar = [
      { id: '1', saldoAtual: 0, precoUnitario: 100 },
      { id: '2', saldoAtual: 10, precoUnitario: 0 }
    ];
    const r = classificarCurvaABC(materiaisZerar, {});
    expect(r.classes.A.length).toBe(0);
    expect(r.classes.B.length).toBe(0);
    expect(r.classes.C.length).toBe(2);
  });
});
