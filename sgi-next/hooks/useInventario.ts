'use client';

import { useReducer, useCallback } from 'react';
import type { Material, ContagensMap } from '@/lib/auxiliaresUI';
import { filtrarMateriais, ordenarPor } from '@/lib/filtros';
import type { FiltroState } from '@/lib/filtros';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AbaAtiva = 'contagem' | 'monitoramento';

export interface InventarioState {
  abaAtiva: AbaAtiva;
  materiais: Material[];
  materiaisVisiveis: Material[];
  contagens: ContagensMap;
  colunaOrdenacao: keyof Material | null;
  direcaoOrdenacao: 'asc' | 'desc';
  filtros: FiltroState;
  carregando: boolean;
}

type Action =
  | { type: 'SET_ABA'; payload: AbaAtiva }
  | { type: 'SET_MATERIAIS'; payload: { materiais: Material[], contagensIniciais: ContagensMap } }
  | { type: 'SET_CARREGANDO'; payload: boolean }
  | { type: 'REGISTRAR_CONTAGEM'; payload: { id: number; novaQtd: number | null; observacao: string } }
  | { type: 'RESTAURAR_CONTAGENS'; payload: ContagensMap }
  | { type: 'SET_FILTRO_TERMO'; payload: string }
  | { type: 'SET_FILTRO_TIPO'; payload: string }
  | { type: 'ORDENAR_COLUNA'; payload: keyof Material }
  | { type: 'RESETAR' };

// ─── Reducer ─────────────────────────────────────────────────────────────────

function aplicarFiltrosEOrdenacao(state: InventarioState): Material[] {
  let visivel = filtrarMateriais(state.materiais, state.filtros);
  if (state.colunaOrdenacao) {
    visivel = ordenarPor(visivel, state.colunaOrdenacao, state.direcaoOrdenacao);
  }
  return visivel;
}

const initialState: InventarioState = {
  abaAtiva: 'contagem',
  materiais: [],
  materiaisVisiveis: [],
  contagens: {},
  colunaOrdenacao: null,
  direcaoOrdenacao: 'asc',
  filtros: { termo: '', tipo: 'todos' },
  carregando: false,
};

function inventarioReducer(state: InventarioState, action: Action): InventarioState {
  switch (action.type) {
    case 'SET_ABA':
      return { ...state, abaAtiva: action.payload };

    case 'SET_CARREGANDO':
      return { ...state, carregando: action.payload };

    case 'SET_MATERIAIS': {
      const newState: InventarioState = {
        ...state,
        materiais: action.payload.materiais,
        contagens: action.payload.contagensIniciais,
        filtros: { termo: '', tipo: 'todos' },
        colunaOrdenacao: null,
        direcaoOrdenacao: 'asc',
        abaAtiva: 'contagem',
      };
      return { ...newState, materiaisVisiveis: action.payload.materiais };
    }

    case 'RESTAURAR_CONTAGENS':
      return { ...state, contagens: action.payload };

    case 'REGISTRAR_CONTAGEM': {
      const { id, novaQtd, observacao } = action.payload;
      const novasContagens = { ...state.contagens };
      if (novaQtd === null || novaQtd === undefined || String(novaQtd) === '') {
        delete novasContagens[id];
      } else {
        novasContagens[id] = { novaQtd, observacao };
      }
      return { ...state, contagens: novasContagens };
    }

    case 'SET_FILTRO_TERMO': {
      const newState = { ...state, filtros: { ...state.filtros, termo: action.payload } };
      return { ...newState, materiaisVisiveis: aplicarFiltrosEOrdenacao(newState) };
    }

    case 'SET_FILTRO_TIPO': {
      const newState = { ...state, filtros: { ...state.filtros, tipo: action.payload } };
      return { ...newState, materiaisVisiveis: aplicarFiltrosEOrdenacao(newState) };
    }

    case 'ORDENAR_COLUNA': {
      const coluna = action.payload;
      const direcao: 'asc' | 'desc' =
        state.colunaOrdenacao === coluna
          ? state.direcaoOrdenacao === 'asc'
            ? 'desc'
            : 'asc'
          : 'asc';
      const newState: InventarioState = { ...state, colunaOrdenacao: coluna, direcaoOrdenacao: direcao };
      return { ...newState, materiaisVisiveis: aplicarFiltrosEOrdenacao(newState) };
    }

    case 'RESETAR':
      return { ...initialState };

    default:
      return state;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useInventario() {
  const [state, dispatch] = useReducer(inventarioReducer, initialState);

  const setAba = useCallback((aba: AbaAtiva) => dispatch({ type: 'SET_ABA', payload: aba }), []);

  const carregarMateriais = useCallback(async (codigoAlmox: string, cidadesValidas?: string[]) => {
    dispatch({ type: 'SET_CARREGANDO', payload: true });
    try {
      let url = '/api/materiais';
      if (codigoAlmox !== 'todos') {
        const [cidade, contrato] = codigoAlmox.split('|');
        url = `/api/materiais?cidade=${encodeURIComponent(cidade)}&contrato=${encodeURIComponent(contrato)}`;
      } else {
        url = '/api/materiais?cidade=todos&contrato=todos';
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let materiais: any[] = await res.json();
      
      if (cidadesValidas && cidadesValidas.length > 0) {
        const permitidas = new Set(cidadesValidas.map((c) => c.toUpperCase()));
        materiais = materiais.filter((m) => permitidas.has(m.origem.toUpperCase()));
      }

      const contagensIniciais: ContagensMap = {};
      materiais.forEach((m) => {
        if (m.ultimaContagemFisica !== undefined && m.ultimaContagemFisica !== null) {
          contagensIniciais[m.id] = { novaQtd: m.ultimaContagemFisica, observacao: '' };
        }
      });

      dispatch({ type: 'SET_MATERIAIS', payload: { materiais, contagensIniciais } });
      return materiais;
    } finally {
      dispatch({ type: 'SET_CARREGANDO', payload: false });
    }
  }, []);

  const registrarContagem = useCallback(
    (id: number, novaQtd: number | null, observacao: string) => {
      dispatch({ type: 'REGISTRAR_CONTAGEM', payload: { id, novaQtd, observacao } });
    },
    []
  );

  const restaurarContagens = useCallback((contagens: ContagensMap) => {
    dispatch({ type: 'RESTAURAR_CONTAGENS', payload: contagens });
  }, []);

  const setFiltroTermo = useCallback((termo: string) => dispatch({ type: 'SET_FILTRO_TERMO', payload: termo }), []);
  const setFiltroTipo = useCallback((tipo: string) => dispatch({ type: 'SET_FILTRO_TIPO', payload: tipo }), []);
  const ordenarColuna = useCallback((coluna: keyof Material) => dispatch({ type: 'ORDENAR_COLUNA', payload: coluna }), []);
  const resetar = useCallback(() => dispatch({ type: 'RESETAR' }), []);

  const gravarContagens = useCallback(
    async (contagens: Array<{ id: number; codmat: string; descricao: string; valorAnterior: number | null; valorNovo: number; observacao?: string }>) => {
      const res = await fetch('/api/contagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contagens),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    []
  );

  return {
    state,
    setAba,
    carregarMateriais,
    registrarContagem,
    restaurarContagens,
    setFiltroTermo,
    setFiltroTipo,
    ordenarColuna,
    resetar,
    gravarContagens,
  };
}
