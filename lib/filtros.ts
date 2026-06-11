/**
 * filtros.ts — Módulo de Filtro, Ordenação e Debounce do SGI
 */
import type { Material, ContagensMap } from './auxiliaresUI';

export interface FiltroState {
  termo: string;
  tipo: string;
  grupo: string;
}

export const ALIAS_CIDADE: Record<string, string> = {
  "BH": "BELO HORIZONTE",
  "GOV VALA": "GOV VALADARES",
  "GOV.VALADARES": "GOV VALADARES",
  "JUIZ DE": "JUIZ DE FORA",
  "VARGINHAS": "VARGINHA",
  // CAMPOS — entradas específicas por nome do grupo
  "IAT CAMPOS": "CAMPOS",
  "CLARO IAT CAMPOS": "CAMPOS",
  "CPS": "CAMPOS",
  "FERRAMENTARIA CPS": "CAMPOS",
  // Rio de Janeiro
  "TIM RJO": "RIO DE JANEIRO",
  "RJO": "RIO DE JANEIRO",
  "FERRAMENTARIA RJO": "RIO DE JANEIRO",
  "SSO RJ": "RIO DE JANEIRO",
  "REG. RJ": "RIO DE JANEIRO",
  "REG.RJ": "RIO DE JANEIRO",
  // Nova Friburgo — "FERRAM. CLARO IAT" é o nome do grupo contrato 21 para Friburgo
  "FERRAM.CLARO IAT": "NOVA FRIBURGO",
  "FRIBURGO": "NOVA FRIBURGO",
  "N FRIBURGO": "NOVA FRIBURGO",
  "N. FRIBURGO": "NOVA FRIBURGO",
  "NVA FRIBURGO": "NOVA FRIBURGO",
  "N.FRIBURGO": "NOVA FRIBURGO",
  "SEG NOVA FRIBURGO": "NOVA FRIBURGO",
  "REGULADOR FRIBURGO": "NOVA FRIBURGO",
};

/**
 * Extrai e padroniza o nome da cidade a partir do campo `grupo` do material.
 * O campo grupo tem formato: "CODIGO/NOME_PROJETO" ex: "21/FERRAM. CLARO IAT"
 * A função remove o prefixo (tudo até o primeiro espaço), normaliza e aplica aliases.
 */
export function padronizarNomeCidade(grupoOriginal: string): string {
  if (!grupoOriginal) return '';
  // Extrai tudo após o primeiro espaço (remove o código tipo "21/FERRAM." ou "21/CLARO")
  let nome = grupoOriginal.substring(grupoOriginal.indexOf(' ') + 1).trim().toUpperCase();
  nome = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, "");
  nome = nome.replace(/\.\s+/g, '.');

  // Lookup direto pelo nome parcial
  if (ALIAS_CIDADE[nome]) return ALIAS_CIDADE[nome];

  // Lookup pelo grupo completo normalizado (sem o prefixo numérico)
  // Ex: "21/FERRAM. CLARO IAT" → remove "21/" → "FERRAM. CLARO IAT" → normaliza → "FERRAM.CLARO IAT"
  const semPrefixo = grupoOriginal.replace(/^\d+\//, '').trim().toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, "")
    .replace(/\.\s+/g, '.');
  if (ALIAS_CIDADE[semPrefixo]) return ALIAS_CIDADE[semPrefixo];

  return nome;
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

    if (filtro.grupo && filtro.grupo !== 'todas') {
      const targetCity = filtro.grupo;
      resultado = resultado.filter((m) => padronizarNomeCidade(m.grupo || '') === targetCity);
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
