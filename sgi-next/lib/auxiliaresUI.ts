/**
 * auxiliaresUI.ts — Funções Auxiliares Puras de Interface do SGI
 * ─────────────────────────────────────────────────────────────────────────────
 * Funções PURAS de suporte à interface: formatação, classificação,
 * cálculos de progresso e proteção contra XSS.
 */

export interface Material {
  id: number;
  origem: string;
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

export interface MaterialComValor extends Material {
  valorEstoque: number;
}

// ─── formatarData ─────────────────────────────────────────────────────────────

export function formatarData(isoString: string | null | undefined): string {
  if (!isoString) return 'Sem data';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return 'Data inválida';
  const dia = String(date.getUTCDate()).padStart(2, '0');
  const mes = String(date.getUTCMonth() + 1).padStart(2, '0');
  const ano = date.getUTCFullYear();
  return `${dia}/${mes}/${ano}`;
}

// ─── getBadgeClass ────────────────────────────────────────────────────────────

export function getBadgeClass(quantidade: number): string {
  if (quantidade <= 0) return 'badge-zero';
  if (quantidade <= 10) return 'badge-low';
  return 'badge-ok';
}

// ─── calcularProgresso ────────────────────────────────────────────────────────

export function calcularProgresso(
  materiais: Material[],
  contagens: ContagensMap
): ProgressoResult {
  const total = materiais.length;
  if (total === 0) return { total: 0, contados: 0, percentual: 0 };
  const contados = materiais.filter((m) => m.id in contagens).length;
  const percentual = Math.floor((contados / total) * 100);
  return { total, contados, percentual };
}

// ─── sanitizarTexto ──────────────────────────────────────────────────────────

export function sanitizarTexto(texto: string | null | undefined): string {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─── truncarTexto ────────────────────────────────────────────────────────────

export function truncarTexto(texto: string | null | undefined, limite: number): string {
  if (texto === null || texto === undefined) return '';
  const str = String(texto);
  if (str.length <= limite) return str;
  return str.slice(0, limite) + '...';
}

// ─── formatarMoeda ────────────────────────────────────────────────────────────

export function formatarMoeda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || isNaN(valor as number)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor as number);
}

// ─── calcularAcuracidade ──────────────────────────────────────────────────────

export function calcularAcuracidade(
  materiais: Material[],
  contagens: ContagensMap
): AcuracidadeResult {
  const total = materiais.length;
  if (total === 0) return { total: 0, contados: 0, acertos: 0, divergentes: 0, taxaAcuracidade: 100 };

  const contagensRealizadas = materiais.filter((m) => m.id in contagens);
  const contados = contagensRealizadas.length;

  if (contados === 0) return { total, contados: 0, acertos: 0, divergentes: 0, taxaAcuracidade: 100 };

  let acertos = 0;
  let divergentes = 0;

  contagensRealizadas.forEach((m) => {
    const contagem = contagens[m.id];
    if (contagem.novaQtd === m.saldoAtual) {
      acertos++;
    } else {
      divergentes++;
    }
  });

  const taxaAcuracidade = Math.round((acertos / contados) * 100);
  return { total, contados, acertos, divergentes, taxaAcuracidade };
}

// ─── calcularFinanceiroDivergencias ───────────────────────────────────────────

export function calcularFinanceiroDivergencias(
  materiais: Material[],
  contagens: ContagensMap
): FinanceiroDivergencias {
  let distorcaoPatrimonial = 0;
  let resultadoLiquido = 0;
  const detalhes: FinanceiroDivergencias['detalhes'] = [];

  materiais.forEach((m) => {
    if (m.id in contagens) {
      const novaQtd = contagens[m.id].novaQtd;
      if (novaQtd !== m.saldoAtual) {
        const desvio = novaQtd - m.saldoAtual;
        const preco = m.precoUnitario || 0;
        const impacto = desvio * preco;
        distorcaoPatrimonial += Math.abs(impacto);
        resultadoLiquido += impacto;
        detalhes.push({ id: m.id, descricao: m.descricao, desvio, precoUnitario: preco, impacto });
      }
    }
  });

  return { distorcaoPatrimonial, resultadoLiquido, detalhes };
}

// ─── classificarCurvaABC ──────────────────────────────────────────────────────

export function classificarCurvaABC(
  materiais: Material[],
  contagens: ContagensMap = {}
): CurvaABCResult {
  const totalMateriais = materiais.length;
  if (totalMateriais === 0) {
    return {
      classes: { A: [], B: [], C: [] },
      acuracidadePorClasse: { A: 100, B: 100, C: 100 },
      valorTotalEstoque: 0,
    };
  }

  const itensComValor: MaterialComValor[] = materiais.map((m) => ({
    ...m,
    valorEstoque: m.saldoAtual * (m.precoUnitario || 0),
  }));

  const valorTotalEstoque = itensComValor.reduce((acc, i) => acc + i.valorEstoque, 0);
  const classes: CurvaABCResult['classes'] = { A: [], B: [], C: [] };

  itensComValor.forEach((item) => {
    const cls = (item.classeABC || 'C').toUpperCase();
    if (cls === 'A') {
      classes.A.push(item);
    } else if (cls === 'B') {
      classes.B.push(item);
    } else {
      classes.C.push(item);
    }
  });

  const acuracidadePorClasse = { A: 100, B: 100, C: 100 };
  (['A', 'B', 'C'] as const).forEach((classe) => {
    acuracidadePorClasse[classe] = calcularAcuracidade(classes[classe], contagens).taxaAcuracidade;
  });

  return { classes, acuracidadePorClasse, valorTotalEstoque };
}
