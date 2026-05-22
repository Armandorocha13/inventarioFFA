import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cidade = searchParams.get('cidade');
  const contrato = searchParams.get('contrato');

  try {
    let query = '';
    let params: (string | number)[] = [];

    if (!cidade || cidade === 'todos' || !contrato || contrato === 'todos') {
      query = `
        SELECT * FROM vw_estoque_contagem
        ORDER BY descricao
      `;
    } else {
      query = `
        SELECT * FROM vw_estoque_contagem
        WHERE origem = $1 AND contrato = $2
        ORDER BY descricao
      `;
      params = [cidade, parseInt(contrato, 10)];
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
        codmat: row.codmat ? row.codmat.trim() : '',
        descricao: row.descricao ? row.descricao.trim() : '',
        unidade: row.unidade ? row.unidade.trim() : '',
        saldoAtual: row.saldoAtual !== null && row.saldoAtual !== undefined ? parseFloat(row.saldoAtual) : 0,
        precoUnitario: row.precoUnitario !== null && row.precoUnitario !== undefined ? parseFloat(row.precoUnitario) : 0,
        ultimaAtualizacao: row.ultimaAtualizacao ? row.ultimaAtualizacao : new Date().toISOString(),
        ultimaContagemFisica: row.ultimaContagemFisica !== null && row.ultimaContagemFisica !== undefined ? parseFloat(row.ultimaContagemFisica) : undefined,
      });
    });

    return NextResponse.json(materiais);
  } catch (err) {
    console.error('❌ Erro no endpoint GET /api/materiais:', err);
    return NextResponse.json({ error: 'Erro ao buscar materiais no banco de dados' }, { status: 500 });
  }
}
