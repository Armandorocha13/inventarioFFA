import { describe, it, expect } from 'vitest';
import {
  validarQuantidade,
  validarContagens,
  validarObservacao,
} from '../js/validacao.js';

describe('validarQuantidade', () => {
  it('deve aceitar zero', () => {
    const r = validarQuantidade(0);
    expect(r.valido).toBe(true);
  });

  it('deve aceitar inteiro positivo', () => {
    expect(validarQuantidade(42).valido).toBe(true);
  });

  it('deve aceitar string numérica inteira', () => {
    expect(validarQuantidade('10').valido).toBe(true);
  });

  it('deve rejeitar número negativo', () => {
    const r = validarQuantidade(-1);
    expect(r.valido).toBe(false);
    expect(r.erro).toBeTruthy();
  });

  it('deve rejeitar string não-numérica', () => {
    const r = validarQuantidade('abc');
    expect(r.valido).toBe(false);
  });

  it('deve rejeitar string vazia', () => {
    const r = validarQuantidade('');
    expect(r.valido).toBe(false);
  });

  it('deve rejeitar undefined e null', () => {
    expect(validarQuantidade(undefined).valido).toBe(false);
    expect(validarQuantidade(null).valido).toBe(false);
  });

  it('deve rejeitar NaN', () => {
    expect(validarQuantidade(NaN).valido).toBe(false);
  });

  it('deve aceitar número decimal quando allowDecimal=true', () => {
    expect(validarQuantidade(1.5, { allowDecimal: true }).valido).toBe(true);
  });

  it('deve rejeitar número decimal quando allowDecimal=false (padrão)', () => {
    expect(validarQuantidade(1.5).valido).toBe(false);
  });

  it('deve respeitar valor máximo quando definido', () => {
    expect(validarQuantidade(1001, { max: 1000 }).valido).toBe(false);
    expect(validarQuantidade(999, { max: 1000 }).valido).toBe(true);
  });

  it('a mensagem de erro deve ser string não-vazia quando inválido', () => {
    const r = validarQuantidade(-5);
    expect(typeof r.erro).toBe('string');
    expect(r.erro.length).toBeGreaterThan(0);
  });
});

describe('validarContagens', () => {
  const contagensValidas = [
    { id: '1', novaQtd: 10 },
    { id: '2', novaQtd: 0 },
  ];

  it('deve retornar valido=true para array de contagens corretas', () => {
    const r = validarContagens(contagensValidas);
    expect(r.valido).toBe(true);
  });

  it('deve retornar valido=false para array vazio', () => {
    const r = validarContagens([]);
    expect(r.valido).toBe(false);
    expect(r.erro).toBeTruthy();
  });

  it('deve retornar valido=false se alguma quantidade for negativa', () => {
    const r = validarContagens([{ id: '1', novaQtd: -5 }]);
    expect(r.valido).toBe(false);
  });

  it('deve retornar valido=false se alguma quantidade for NaN', () => {
    const r = validarContagens([{ id: '1', novaQtd: NaN }]);
    expect(r.valido).toBe(false);
  });

  it('deve retornar valido=false se algum item não tiver id', () => {
    const r = validarContagens([{ novaQtd: 5 }]);
    expect(r.valido).toBe(false);
  });

  it('deve retornar os ids inválidos quando houver erros', () => {
    const r = validarContagens([
      { id: '1', novaQtd: 10 },
      { id: '2', novaQtd: -1 },
    ]);
    expect(r.valido).toBe(false);
    expect(r.idsInvalidos).toContain('2');
  });
});

describe('validarObservacao', () => {
  it('deve aceitar string vazia (observação é opcional)', () => {
    expect(validarObservacao('').valido).toBe(true);
  });

  it('deve aceitar string normal', () => {
    expect(validarObservacao('Divergência detectada no setor B').valido).toBe(true);
  });

  it('deve rejeitar observação acima do limite de caracteres (500)', () => {
    const longa = 'a'.repeat(501);
    const r = validarObservacao(longa);
    expect(r.valido).toBe(false);
    expect(r.erro).toBeTruthy();
  });

  it('deve aceitar exatamente 500 caracteres', () => {
    const exata = 'a'.repeat(500);
    expect(validarObservacao(exata).valido).toBe(true);
  });

  it('deve aceitar null e undefined como ausência de observação', () => {
    expect(validarObservacao(null).valido).toBe(true);
    expect(validarObservacao(undefined).valido).toBe(true);
  });
});
