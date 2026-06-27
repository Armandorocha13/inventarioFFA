/**
 * Listagem de materiais e cálculo da Curva ABC (Pareto 80/15/5).
 *
 * A Curva ABC é calculada server-side sobre o conjunto retornado pela query,
 * para que os clientes recebam `classeABC` já preenchida.
 */
import { db } from '@/lib/db';
import type { Material } from '@/lib/domain/types';

const CONTRATOS_AUTORIZADOS = [1, 21, 41, 61, 62, 31, 58, 59, 71, 72];

// Itens que não são ferramenta nem SSO — sempre excluídos.
const EXCLUDE_TIPOS_SQL = `
  AND descricao NOT ILIKE 'DET-%'
  AND descricao NOT ILIKE 'REAP-%'
  AND descricao NOT ILIKE 'DEF-%'
  AND descricao NOT ILIKE '%MAQUINA%'
  AND descricao NOT ILIKE '%MÁQUINA%'
  AND descricao NOT ILIKE '%OTDR%'
  AND descricao NOT ILIKE '%CLIVADOR%'
  AND descricao NOT ILIKE '%MEDIDOR%'
  AND descricao NOT ILIKE '%LEAKAGE%'
  AND descricao NOT ILIKE '%GERADOR%'
  AND descricao NOT ILIKE '%OLP-88%'
  AND descricao NOT ILIKE '%ONU FINDER%'
  AND descricao NOT ILIKE '%POWER MEETER%'
  AND descricao NOT ILIKE '%IDENTIFICADOR DE FIBRA%'
  AND descricao NOT ILIKE '%ESCADA DE FIBRA%'
  AND descricao NOT ILIKE '%EQUIPAMENTO%'
  AND descricao NOT ILIKE '%EMPILHADEIRA%'
`;

export interface ListarMateriaisParams {
  cidade?: string | null;
  contrato?: string | null;
  projeto?: string | null;
}

interface MaterialRow {
  id: number;
  origem: string | null;
  grupo: string | null;
  codmat: string | null;
  descricao: string | null;
  unidade: string | null;
  saldoAtual: string | number | null;
  precoUnitario: string | number | null;
  classeABC: string | null;
  ultimaAtualizacao?: string | null;
  ultimaContagemFisica: string | number | null;
}

function normalizarUpper(s: string): string {
  return s.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function aplicarCurvaABC(materiais: Material[]): Material[] {
  // Se todos os materiais já vierem com classeABC do banco, retornamos direto
  if (materiais.every((m) => m.classeABC)) {
    return materiais;
  }

  const comValor = materiais.map((m) => ({
    material: m,
    valor: (m.saldoAtual || 0) * (m.precoUnitario || 0),
  }));
  comValor.sort((a, b) => b.valor - a.valor);

  const total = comValor.reduce((acc, x) => acc + x.valor, 0);
  let acumulado = 0;
  comValor.forEach((x) => {
    acumulado += x.valor;
    const pct = total > 0 ? acumulado / total : 0;
    if (!x.material.classeABC) {
      if (pct <= 0.8) x.material.classeABC = 'A';
      else if (pct <= 0.95) x.material.classeABC = 'B';
      else x.material.classeABC = 'C';
    }
  });

  return comValor.map((x) => x.material);
}

export async function listarMateriais(params: ListarMateriaisParams): Promise<Material[]> {
  const { cidade, contrato, projeto } = params;

  let sql: string;
  let queryParams: Array<unknown>;

  const semFiltro =
    !cidade || cidade === 'todos' || !contrato || contrato === 'todos';

  if (semFiltro) {
    // Lista de contratos é constante (não vem do usuário) → inline seguro e
    // portável entre Postgres e SQLite.
    const listaContratos = CONTRATOS_AUTORIZADOS.join(', ');
    sql = `
      SELECT * FROM vw_estoque_contagem
       WHERE contrato IN (${listaContratos})
       ${EXCLUDE_TIPOS_SQL}
       ORDER BY descricao
    `;
    queryParams = [];
  } else {
    const queryContrato = parseInt(contrato!, 10);
    if (!CONTRATOS_AUTORIZADOS.includes(queryContrato)) return [];

    const queryCidade = normalizarUpper(cidade!);

    if (projeto) {
      sql = `
        SELECT * FROM vw_estoque_contagem
         WHERE TRANSLATE(UPPER(origem), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC') = $1
           AND contrato = $2
           AND grupo = $3
         ${EXCLUDE_TIPOS_SQL}
         ORDER BY descricao
      `;
      queryParams = [queryCidade, queryContrato, projeto];
    } else {
      sql = `
        SELECT * FROM vw_estoque_contagem
         WHERE TRANSLATE(UPPER(origem), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC') = $1
           AND contrato = $2
         ${EXCLUDE_TIPOS_SQL}
         ORDER BY descricao
      `;
      queryParams = [queryCidade, queryContrato];
    }
  }

  const { rows } = await db.query<MaterialRow>(sql, queryParams as never);

  const vistos = new Set<number>();
  const materiais: Material[] = [];

  rows.forEach((row) => {
    if (vistos.has(row.id)) return;
    vistos.add(row.id);

    const saldoAtual = row.saldoAtual != null ? parseFloat(String(row.saldoAtual)) : 0;
    const precoUnitario = row.precoUnitario != null ? parseFloat(String(row.precoUnitario)) : 0;
    const ultimaContagemFisica =
      row.ultimaContagemFisica != null ? parseFloat(String(row.ultimaContagemFisica)) : undefined;

    materiais.push({
      id: row.id,
      origem: row.origem ? row.origem.trim() : '',
      grupo: row.grupo ? row.grupo.trim() : '',
      contrato: row.contrato != null ? parseInt(String(row.contrato), 10) : undefined,
      codmat: row.codmat ? row.codmat.trim() : '',
      descricao: row.descricao ? row.descricao.trim() : '',
      unidade: row.unidade ? row.unidade.trim() : '',
      saldoAtual,
      precoUnitario,
      ultimaAtualizacao: row.ultimaAtualizacao ?? new Date().toISOString(),
      ultimaContagemFisica,
      classeABC: row.classeABC ? row.classeABC.trim() : null,
    });
  });

  return aplicarCurvaABC(materiais);
}
