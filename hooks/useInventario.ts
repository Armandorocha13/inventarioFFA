'use client';

import { useReducer, useCallback } from 'react';
import type { Material, ContagensMap } from '@/lib/domain/types';
import type { ContagemInput } from '@/lib/domain/types';
import { filtrarMateriais, ordenarPor } from '@/lib/filtros';
import type { FiltroState } from '@/lib/filtros';

// Material acrescido de campo temporário usado só no cálculo da Curva ABC.
type MaterialABC = Material & { valorEstoqueTemp?: number };

// ─── Types ────────────────────────────────────────────────────────────────────

export type AbaAtiva = 'contagem' | 'monitoramento' | 'upload';

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
  | { type: 'SET_FILTRO_GRUPO'; payload: string }
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
  filtros: { termo: '', tipo: 'todos', grupo: 'todas' },
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
        filtros: { termo: '', tipo: 'todos', grupo: 'todas' },
        colunaOrdenacao: null,
        direcaoOrdenacao: 'asc',
        // Mantem a aba atual definida pelo login
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

    case 'SET_FILTRO_GRUPO': {
      const newState = { ...state, filtros: { ...state.filtros, grupo: action.payload } };
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
        const parts = codigoAlmox.split('|');
        const cidade = parts[0];
        const contrato = parts[1];
        const projeto = parts[2];
        url = `/api/materiais?cidade=${encodeURIComponent(cidade)}&contrato=${encodeURIComponent(contrato)}`;
        if (projeto) {
          url += `&projeto=${encodeURIComponent(projeto)}`;
        }
      } else {
        url = '/api/materiais?cidade=todos&contrato=todos';
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let materiais: MaterialABC[] = await res.json();
      
      if (cidadesValidas && cidadesValidas.length > 0) {
        const normalizeStr = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
        const permitidas = new Set(cidadesValidas.map(normalizeStr));
        materiais = materiais.filter((m) => permitidas.has(normalizeStr(m.origem)));
      }

      const jaTemABC = materiais.every((m) => m.classeABC);
      if (!jaTemABC) {
        // Cálculo Dinâmico da Curva ABC (Pareto 80/15/5) para o contexto atual
        materiais.forEach((m) => {
          m.valorEstoqueTemp = (m.saldoAtual || 0) * (m.precoUnitario || 0);
        });
        materiais.sort((a, b) => (b.valorEstoqueTemp ?? 0) - (a.valorEstoqueTemp ?? 0));
        const valorTotalEstoque = materiais.reduce((acc, m) => acc + (m.valorEstoqueTemp ?? 0), 0);
        
        let somaAcumulada = 0;
        materiais.forEach((m) => {
          somaAcumulada += m.valorEstoqueTemp ?? 0;
          const percentual = valorTotalEstoque > 0 ? somaAcumulada / valorTotalEstoque : 0;
          
          if (percentual <= 0.8) {
            m.classeABC = 'A';
          } else if (percentual <= 0.95) {
            m.classeABC = 'B';
          } else {
            m.classeABC = 'C';
          }
          delete m.valorEstoqueTemp;
        });
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
  const setFiltroGrupo = useCallback((grupo: string) => dispatch({ type: 'SET_FILTRO_GRUPO', payload: grupo }), []);
  const ordenarColuna = useCallback((coluna: keyof Material) => dispatch({ type: 'ORDENAR_COLUNA', payload: coluna }), []);
  const resetar = useCallback(() => dispatch({ type: 'RESETAR' }), []);

  const gravarContagens = useCallback(
    async (contagens: ContagemInput[]) => {
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
    setFiltroGrupo,
    ordenarColuna,
    resetar,
    gravarContagens,
  };
}
