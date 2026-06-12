import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

// Contratos autorizados no sistema
const CONTRATOS_AUTORIZADOS = new Set([1, 21, 41, 61, 62, 31, 58, 59, 71, 72]);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cidade = searchParams.get('cidade');
  const contrato = searchParams.get('contrato');

  try {
    let query = '';
    let params: any[] = [];

    // Exclui itens que NÃO são ferramentas nem SSO:
    // prefixos DET- / REAP- / DEF- e equipamentos de medição/fusão/maquinário
    const EXCLUDE_TIPOS = `
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

    if (!cidade || cidade === 'todos' || !contrato || contrato === 'todos') {
      // Sem filtro específico: retorna todos os materiais dos contratos autorizados
      query = `
        SELECT * FROM vw_estoque_contagem
        WHERE contrato = ANY($1::int[])
        ${EXCLUDE_TIPOS}
        ORDER BY descricao
      `;
      params = [Array.from(CONTRATOS_AUTORIZADOS)];
    } else {
      const queryCidade = (cidade || '').trim();
      const queryContrato = parseInt(contrato || '', 10);

      // Validar se o contrato está autorizado
      if (!CONTRATOS_AUTORIZADOS.has(queryContrato)) {
        return NextResponse.json([]);
      }

      query = `
        SELECT * FROM vw_estoque_contagem
        WHERE origem = $1 AND contrato = $2
        ${EXCLUDE_TIPOS}
        ORDER BY descricao
      `;
      params = [queryCidade, queryContrato];
    }

    const result = await pool.query(query, params);

    const vistos = new Set<number>();
    const materiais: any[] = [];

    result.rows.forEach((row) => {
      if (vistos.has(row.id)) return;
      vistos.add(row.id);

      materiais.push({
        id: row.id,
        origem: row.origem ? row.origem.trim() : '',
        grupo: row.grupo ? row.grupo.trim() : '',
        codmat: row.codmat ? row.codmat.trim() : '',
        descricao: row.descricao ? row.descricao.trim() : '',
        unidade: row.unidade ? row.unidade.trim() : '',
        saldoAtual: row.saldoAtual !== null && row.saldoAtual !== undefined ? parseFloat(row.saldoAtual) : 0,
        precoUnitario: row.precoUnitario !== null && row.precoUnitario !== undefined ? parseFloat(row.precoUnitario) : 0,
        ultimaAtualizacao: row.ultimaAtualizacao ? row.ultimaAtualizacao : new Date().toISOString(),
        ultimaContagemFisica: row.ultimaContagemFisica !== null && row.ultimaContagemFisica !== undefined ? parseFloat(row.ultimaContagemFisica) : undefined,
        classeABC: row.classeABC ? row.classeABC.trim() : null,
      });
    });

    return NextResponse.json(materiais);
  } catch (err) {
    console.error('❌ Erro no endpoint GET /api/materiais:', err);
    return NextResponse.json({ error: 'Erro ao buscar materiais no banco de dados' }, { status: 500 });
  }
}
