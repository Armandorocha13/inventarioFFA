/**
 * Tipos de domínio do SGI.
 * Fonte única de verdade — toda camada (rotas, services, hooks, componentes)
 * importa daqui.
 */

export interface Material {
  id: number;
  origem: string;
  grupo?: string;
  codmat: string;
  descricao: string;
  unidade: string;
  saldoAtual: number;
  precoUnitario: number;
  ultimaAtualizacao: string;
  ultimaContagemFisica?: number;
  classeABC?: string | null;
}

export interface Contagem {
  novaQtd: number;
  observacao: string;
}

export type ContagensMap = Record<number, Contagem>;

export interface MaterialComValor extends Material {
  valorEstoque: number;
}

export interface ProgressoResult {
  total: number;
  contados: number;
  percentual: number;
}

export interface AcuracidadeResult {
  total: number;
  contados: number;
  acertos: number;
  divergentes: number;
  taxaAcuracidade: number;
}

export interface FinanceiroDivergencias {
  distorcaoPatrimonial: number;
  resultadoLiquido: number;
  detalhes: Array<{
    id: number;
    descricao: string;
    desvio: number;
    precoUnitario: number;
    impacto: number;
  }>;
}

export interface CurvaABCResult {
  classes: {
    A: MaterialComValor[];
    B: MaterialComValor[];
    C: MaterialComValor[];
  };
  acuracidadePorClasse: { A: number; B: number; C: number };
  valorTotalEstoque: number;
}

export interface UF {
  sigla: string;
  nome: string;
}

export interface Almoxarifado {
  codigo: string;
  label: string;
  cidade: string;
  contrato: number;
}

export interface FiltrosResponse {
  estados: UF[];
  almoxarifados: Record<string, Almoxarifado[]>;
}

export interface HistoricoRegistro {
  id: number;
  codmat: string;
  descricao: string;
  valorAnterior: number | null;
  valorNovo: number;
  desvio: number;
  observacao: string | null;
  timestamp: string;
}

export interface ContagemInput {
  id: number;
  origem: string;
  grupo?: string;
  codmat: string;
  descricao: string;
  valorAnterior: number | null;
  valorNovo: number;
  observacao?: string;
}
