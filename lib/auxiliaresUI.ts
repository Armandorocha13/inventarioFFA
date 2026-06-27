/**
 * Funções puras de suporte à UI: formatação, classificação, cálculos
 * de progresso/acuracidade e sanitização.
 *
 * Tipos de domínio vivem em `lib/domain/types`. Re-exportamos aqui apenas
 * para manter compatibilidade com imports antigos.
 */

import type {
  Material,
  Contagem,
  ContagensMap,
  ProgressoResult,
  AcuracidadeResult,
  FinanceiroDivergencias,
  CurvaABCResult,
  MaterialComValor,
} from './domain/types';

export type {
  Material,
  Contagem,
  ContagensMap,
  ProgressoResult,
  AcuracidadeResult,
  FinanceiroDivergencias,
  CurvaABCResult,
  MaterialComValor,
};

export function formatarData(isoString: string | null | undefined): string {
  if (!isoString) return 'Sem data';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return 'Data inválida';
  const dia = String(date.getUTCDate()).padStart(2, '0');
  const mes = String(date.getUTCMonth() + 1).padStart(2, '0');
  const ano = date.getUTCFullYear();
  return `${dia}/${mes}/${ano}`;
}

export function getBadgeClass(quantidade: number): string {
  if (quantidade <= 0) return 'badge-zero';
  if (quantidade <= 10) return 'badge-low';
  return 'badge-ok';
}

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

export function sanitizarTexto(texto: string | null | undefined): string {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function truncarTexto(texto: string | null | undefined, limite: number): string {
  if (texto === null || texto === undefined) return '';
  const str = String(texto);
  if (str.length <= limite) return str;
  return str.slice(0, limite) + '...';
}

export function formatarMoeda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || isNaN(valor as number)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor as number);
}

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
    if (contagem.novaQtd === m.saldoAtual) acertos++;
    else divergentes++;
  });

  const taxaAcuracidade = Math.round((acertos / contados) * 100);
  return { total, contados, acertos, divergentes, taxaAcuracidade };
}

export function calcularFinanceiroDivergencias(
  materiais: Material[],
  contagens: ContagensMap
): FinanceiroDivergencias {
  let distorcaoPatrimonial = 0;
  let resultadoLiquido = 0;
  const detalhes: FinanceiroDivergencias['detalhes'] = [];

  materiais.forEach((m) => {
    if (!(m.id in contagens)) return;
    const novaQtd = contagens[m.id].novaQtd;
    if (novaQtd === m.saldoAtual) return;
    const desvio = novaQtd - m.saldoAtual;
    const preco = m.precoUnitario || 0;
    const impacto = desvio * preco;
    distorcaoPatrimonial += Math.abs(impacto);
    resultadoLiquido += impacto;
    detalhes.push({ id: m.id, descricao: m.descricao, desvio, precoUnitario: preco, impacto });
  });

  return { distorcaoPatrimonial, resultadoLiquido, detalhes };
}

export function classificarCurvaABC(
  materiais: Material[],
  contagens: ContagensMap = {}
): CurvaABCResult {
  if (materiais.length === 0) {
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

  // Deduplica por codmat mantendo apenas o item de maior valorEstoque por codmat.
  const maiorPorCodmat = new Map<string, MaterialComValor>();
  for (const item of itensComValor) {
    const key = item.codmat ?? String(item.id);
    const existente = maiorPorCodmat.get(key);
    if (!existente || item.valorEstoque > existente.valorEstoque) {
      maiorPorCodmat.set(key, item);
    }
  }

  Array.from(maiorPorCodmat.values()).forEach((item) => {
    const cls = (item.classeABC || 'C').toUpperCase();
    if (cls === 'A') classes.A.push(item);
    else if (cls === 'B') classes.B.push(item);
    else classes.C.push(item);
  });

  const acuracidadePorClasse = { A: 100, B: 100, C: 100 };
  (['A', 'B', 'C'] as const).forEach((classe) => {
    acuracidadePorClasse[classe] = calcularAcuracidade(classes[classe], contagens).taxaAcuracidade;
  });

  return { classes, acuracidadePorClasse, valorTotalEstoque };
}
