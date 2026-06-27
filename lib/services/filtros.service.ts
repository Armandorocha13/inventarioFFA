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
}

function pushAlmoxarifadoSP(
  almoxarifados: Record<string, Almoxarifado[]>,
  ufSigla: string,
  cidade: string,
  contrato: number,
  visitados: Set<string>
): void {
  const key = `${cidade}|${contrato}`;
  if (visitados.has(key)) return;
  visitados.add(key);

  if (contrato === 1) {
    almoxarifados[ufSigla].push(
      { codigo: `${cidade}|1|01/FERRAMENTARIA SP`, label: `${cidade} - CONTRATO: 1 (FERRAMENTARIA)`, cidade, contrato },
      { codigo: `${cidade}|1|01/SEG. DO TRABALHO SP`, label: `${cidade} - CONTRATO: 1 (SSO)`, cidade, contrato }
    );
    return;
  }
  if (contrato === 31) {
    almoxarifados[ufSigla].push(
      { codigo: `${cidade}|31|31/FERRAMENTARIA SP`, label: `${cidade} - CONTRATO: 31 (FERRAMENTARIA)`, cidade, contrato },
      { codigo: `${cidade}|31|31/SEGURANÇA D TRABALHO`, label: `${cidade} - CONTRATO: 31 (SSO)`, cidade, contrato }
    );
  }
}

function rotuloTipoContrato(contrato: number): string {
  if (contrato === 31) return 'FERRAMENTARIA E SSO';
  if ([1, 21, 61, 58, 71].includes(contrato)) return 'FERRAMENTARIA';
  return 'SSO';
}

function normalizarCidade(cidade: string): string {
  return cidade.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

export async function listarFiltros(): Promise<FiltrosResponse> {
  const { rows } = await db.query<ProjetoRow>(
    `SELECT DISTINCT cidade, contrato
       FROM de_para_projeto
      ORDER BY cidade ASC, contrato ASC`
  );

  const estadosMap = new Map<string, UF>();
  const almoxarifados: Record<string, Almoxarifado[]> = {};
  const visitados = new Set<string>();

  rows.forEach((row) => {
    const cidade = row.cidade ? String(row.cidade).trim() : '';
    const contrato = row.contrato != null ? parseInt(String(row.contrato), 10) : NaN;
    if (!cidade || !contrato || !CONTRATOS_AUTORIZADOS.has(contrato)) return;

    const uf = CONTRATO_UF_MAP[contrato];
    if (!uf) return;

    if (!estadosMap.has(uf.sigla)) estadosMap.set(uf.sigla, uf);
    if (!almoxarifados[uf.sigla]) almoxarifados[uf.sigla] = [];

    const ehSaoPauloDuplo =
      normalizarCidade(cidade) === 'SAO PAULO' && (contrato === 1 || contrato === 31);

    if (ehSaoPauloDuplo) {
      pushAlmoxarifadoSP(almoxarifados, uf.sigla, cidade, contrato, visitados);
      return;
    }

    const codigo = `${cidade}|${contrato}`;
    if (visitados.has(codigo)) return;
    visitados.add(codigo);

    almoxarifados[uf.sigla].push({
      codigo,
      label: `${cidade} - CONTRATO: ${contrato} (${rotuloTipoContrato(contrato)})`,
      cidade,
      contrato,
    });
  });

  for (const uf of Object.keys(almoxarifados)) {
    almoxarifados[uf].sort((a, b) => a.contrato - b.contrato);
  }

  const estados = Array.from(estadosMap.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  return { estados, almoxarifados };
}
