import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    const query = `
      SELECT 
        id,
        codmat,
        descricao,
        "saldoAtual" AS "valorAnterior",
        "ultimaContagemFisica" AS "valorNovo",
        ("ultimaContagemFisica" - "saldoAtual") AS desvio,
        NULL AS observacao,
        CURRENT_TIMESTAMP AS timestamp
      FROM vw_estoque_contagem
      WHERE "ultimaContagemFisica" IS NOT NULL
      ORDER BY descricao
      LIMIT 100
    `;
    const result = await pool.query(query);

    const historico = result.rows.map((row) => ({
      id: row.id,
      codmat: row.codmat ? row.codmat.trim() : '',
      descricao: row.descricao ? row.descricao.trim() : '',
      valorAnterior: row.valorAnterior !== null ? parseFloat(row.valorAnterior) : null,
      valorNovo: row.valorNovo !== null ? parseFloat(row.valorNovo) : 0,
      desvio: row.desvio !== null ? parseFloat(row.desvio) : 0,
      observacao: row.observacao ? row.observacao.trim() : null,
      timestamp: row.timestamp,
    }));

    return NextResponse.json(historico);
  } catch (err) {
    console.error('❌ Erro no endpoint GET /api/historico:', err);
    return NextResponse.json({ error: 'Erro ao buscar histórico de auditorias no banco' }, { status: 500 });
  }
}
