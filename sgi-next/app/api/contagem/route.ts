import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

interface ItemContagem {
  id: number;
  origem: string;
  codmat: string;
  descricao: string;
  valorAnterior: number | null;
  valorNovo: number;
}

export async function POST(request: NextRequest) {
  let contagens: ItemContagem[];

  try {
    contagens = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido no corpo da requisição.' }, { status: 400 });
  }

  if (!Array.isArray(contagens) || contagens.length === 0) {
    return NextResponse.json(
      { error: 'Corpo da requisição deve ser um array válido de contagens.' },
      { status: 400 }
    );
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const item of contagens) {
      const { id, origem, codmat, valorNovo } = item;

      await client.query(
        `INSERT INTO progresso_contagem (cidade, codmat, quantidade_contada)
         VALUES ($1, $2, $3)
         ON CONFLICT (cidade, codmat) DO UPDATE SET quantidade_contada = EXCLUDED.quantidade_contada, atualizado_em = CURRENT_TIMESTAMP`,
        [origem || 'ND', codmat, parseFloat(String(valorNovo))]
      );

      await client.query(
        `UPDATE saldo_estoque SET saldo_disponivel = $1 WHERE id = $2`,
        [parseFloat(String(valorNovo)), parseInt(String(id), 10)]
      );
    }

    await client.query('COMMIT');
    return NextResponse.json({ success: true, count: contagens.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao gravar contagens e atualizar estoque:', err);
    return NextResponse.json(
      { error: 'Erro ao gravar as contagens físicas no banco de dados.' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
