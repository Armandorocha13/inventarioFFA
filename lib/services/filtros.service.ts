/**
 * Consulta os filtros de UF e Almoxarifado disponíveis.
 */
import { db } from '@/lib/db';
import type { Almoxarifado, FiltrosResponse, UF } from '@/lib/domain/types';

const CONTRATO_UF_MAP: Record<number, UF> = {
  1: { sigla: 'SP', nome: 'São Paulo' },
  21: { sigla: 'RJ', nome: 'Rio de Janeiro' },
  41: { sigla: 'RJ', nome: 'Rio de Janeiro' },
  61: { sigla: 'ES', nome: 'Espírito Santo' },
  62: { sigla: 'ES', nome: 'Espírito Santo' },
  31: { sigla: 'SP', nome: 'São Paulo' },
  58: { sigla: 'MG', nome: 'Minas Gerais' },
  59: { sigla: 'MG', nome: 'Minas Gerais' },
  71: { sigla: 'PR', nome: 'Paraná' },
  72: { sigla: 'PR', nome: 'Paraná' },
};

const CONTRATOS_AUTORIZADOS = new Set(Object.keys(CONTRATO_UF_MAP).map(Number));

interface ProjetoRow {
  cidade: string | null;
  contrato: string | number | null;
  projeto: string | null;
}

export async function listarFiltros(): Promise<FiltrosResponse> {
  const { rows } = await db.query<ProjetoRow>(
    `SELECT DISTINCT cidade, contrato, projeto
       FROM de_para_projeto
      ORDER BY cidade ASC, contrato ASC, projeto ASC`
  );

  const estadosMap = new Map<string, UF>();
  const almoxarifados: Record<string, Almoxarifado[]> = {};
  const visitados = new Set<string>();

  rows.forEach((row) => {
    const cidade = row.cidade ? String(row.cidade).trim() : '';
    const contrato = row.contrato != null ? parseInt(String(row.contrato), 10) : NaN;
    const projeto = row.projeto ? String(row.projeto).trim() : '';

    if (!cidade || !contrato || !projeto || !CONTRATOS_AUTORIZADOS.has(contrato)) return;

    const uf = CONTRATO_UF_MAP[contrato];
    if (!uf) return;

    if (!estadosMap.has(uf.sigla)) estadosMap.set(uf.sigla, uf);
    if (!almoxarifados[uf.sigla]) almoxarifados[uf.sigla] = [];

    const codigo = `${cidade}|${contrato}|${projeto}`;
    if (visitados.has(codigo)) return;
    visitados.add(codigo);

    almoxarifados[uf.sigla].push({
      codigo,
      label: `${cidade} - CONTRATO: ${contrato} (${projeto})`,
      cidade,
      contrato,
    });
  });

  for (const uf of Object.keys(almoxarifados)) {
    almoxarifados[uf].sort((a, b) => a.contrato - b.contrato || a.label.localeCompare(b.label));
  }

  const estados = Array.from(estadosMap.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  return { estados, almoxarifados };
}
