import { NextResponse } from 'next/server';
import { listarFiltros } from '@/lib/services/filtros.service';

export async function GET() {
  try {
    const filtros = await listarFiltros();
    return NextResponse.json(filtros);
  } catch (err) {
    console.error('❌ Erro no endpoint GET /api/filtros:', err);
    return NextResponse.json({ error: 'Erro ao buscar filtros no banco de dados' }, { status: 500 });
  }
}
