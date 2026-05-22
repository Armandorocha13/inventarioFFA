/**
 * filtros.ts — Módulo de Filtro, Ordenação e Debounce do SGI
 */
import type { Material, ContagensMap } from './auxiliaresUI';

export interface FiltroState {
  termo: string;
  tipo: string;
}

export function filtrarMateriais(
  materiais: Material[],
  filtro: FiltroState | string,
  contagens: ContagensMap = {},
  apenasDivergentes = false
): Material[] {
  let resultado = [...materiais];

  if (apenasDivergentes) {
    resultado = resultado.filter((m) => {
      const temContagem = m.id in contagens;
      if (!temContagem) return false;
      return contagens[m.id].novaQtd !== m.saldoAtual;
    });
  }

  if (typeof filtro === 'string') {
    if (!filtro || filtro.trim() === '') return resultado;
    const termoUpper = filtro.trim().toUpperCase();
    return resultado.filter((m) => {
      const descricao = (m.descricao || '').toUpperCase();
      const origem = (m.origem || '').toUpperCase();
      const unidade = (m.unidade || '').toUpperCase();
      return descricao.includes(termoUpper) || origem.includes(termoUpper) || unidade.includes(termoUpper);
    });
  }

  if (filtro && typeof filtro === 'object') {
    const { termo, tipo } = filtro;

    if (termo && termo.trim() !== '') {
      const termoUpper = termo.trim().toUpperCase();
      resultado = resultado.filter((m) => {
        const descricao = (m.descricao || '').toUpperCase();
        const origem = (m.origem || '').toUpperCase();
        const uni = (m.unidade || '').toUpperCase();
        return descricao.includes(termoUpper) || origem.includes(termoUpper) || uni.includes(termoUpper);
      });
    }

    if (tipo && tipo !== 'todos') {
      resultado = resultado.filter((m) => (m.descricao || '') === tipo);
    }
  }

  return resultado;
}

export function ordenarPor(
  materiais: Material[],
  coluna: keyof Material,
  direcao: 'asc' | 'desc' = 'asc'
): Material[] {
  if (!materiais.length) return [];
  const mult = direcao === 'desc' ? -1 : 1;

  return [...materiais].sort((a, b) => {
    const va = a[coluna];
    const vb = b[coluna];
    if (va === null || va === undefined) return 1;
    if (vb === null || vb === undefined) return -1;
    if (typeof va === 'number' && typeof vb === 'number') return mult * (va - vb);
    const sa = String(va).toUpperCase();
    const sb = String(vb).toUpperCase();
    if (sa < sb) return mult * -1;
    if (sa > sb) return mult * 1;
    return 0;
  });
}

export function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return function (this: unknown, ...args: unknown[]) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  } as T;
}
