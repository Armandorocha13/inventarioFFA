import { describe, it, expect } from 'vitest';
import { padronizarNomeCidade } from '@/lib/filtros';

describe('padronizarNomeCidade', () => {
  it('deve padronizar nomes de cidade normais e conhecidos', () => {
    expect(padronizarNomeCidade('58/FFA BELO HORIZONTE')).toBe('BELO HORIZONTE');
    expect(padronizarNomeCidade('21/CLARO LAGOS')).toBe('LAGOS');
    expect(padronizarNomeCidade('21/CLARO PETROPOLIS')).toBe('PETROPOLIS');
    expect(padronizarNomeCidade('21/FERRAM. NITERÓI')).toBe('NITEROI');
    expect(padronizarNomeCidade('21/FERRAMENTARIA CPS')).toBe('CAMPOS');
    expect(padronizarNomeCidade('21/CLARO TERESOPOLIS')).toBe('TERESOPOLIS');
    expect(padronizarNomeCidade('41/SEG TERESÓPOLIS')).toBe('TERESOPOLIS');
  });

  it('deve mapear aliases específicos', () => {
    expect(padronizarNomeCidade('58/BH')).toBe('BELO HORIZONTE');
    expect(padronizarNomeCidade('21/FERRAM. CLARO IAT')).toBe('NOVA FRIBURGO');
    expect(padronizarNomeCidade('21/TIM RJO')).toBe('RIO DE JANEIRO');
    expect(padronizarNomeCidade('21/REG. RJ')).toBe('RIO DE JANEIRO');
  });

  it('deve aplicar fallback correto baseado no contrato para nomes genéricos ou inválidos', () => {
    // Paraná / Curitiba (contrato 71, 72)
    expect(padronizarNomeCidade('71/CORRETIVA')).toBe('CURITIBA');
    expect(padronizarNomeCidade('71/- CLARO IAT - PR')).toBe('CURITIBA');
    expect(padronizarNomeCidade('72/SSO - LIGGA CTB - PR')).toBe('CURITIBA');
    
    // São Paulo (contrato 1, 31, 36)
    expect(padronizarNomeCidade('31/FERRAMENTARIA SP')).toBe('SAO PAULO');
    expect(padronizarNomeCidade('36/FTTC')).toBe('SAO PAULO');
    expect(padronizarNomeCidade('31/D TRABALHO')).toBe('SAO PAULO');

    // Espírito Santo (contrato 61, 62, 64)
    expect(padronizarNomeCidade('64/ESSJC01')).toBe('VITORIA');
    expect(padronizarNomeCidade('61/ESPIRITO SANTO')).toBe('VITORIA');
    
    // Rio de Janeiro (contrato 21, 23, 24, 47, 48)
    expect(padronizarNomeCidade('47/MDU ESTOQUE')).toBe('RIO DE JANEIRO');
    expect(padronizarNomeCidade('48/REGULADOR')).toBe('RIO DE JANEIRO');
    expect(padronizarNomeCidade('23/SAR GPON')).toBe('RIO DE JANEIRO');
    expect(padronizarNomeCidade('60/OBRA DUTRA')).toBe('RIO DE JANEIRO');
  });

  it('deve tratar o contrato 52 com subdivisões de estados de forma especial', () => {
    expect(padronizarNomeCidade('52/PARANÁ')).toBe('CURITIBA');
    expect(padronizarNomeCidade('52/MINAS GERAIS')).toBe('BELO HORIZONTE');
    expect(padronizarNomeCidade('52/RIO DE JANEIRO')).toBe('RIO DE JANEIRO');
  });

  it('deve retornar vazio se a string for vazia ou nula', () => {
    expect(padronizarNomeCidade('')).toBe('');
  });
});
