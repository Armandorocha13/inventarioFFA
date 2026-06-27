import { NextResponse } from 'next/server';
import { listarHistorico } from '@/lib/services/historico.service';

export async function GET() {
  try {
    const historico = await listarHistorico();
    return NextResponse.json(historico);
  } catch (err) {
    console.error('❌ Erro no endpoint GET /api/historico:', err);
    return NextResponse.json({ error: 'Erro ao buscar histórico de auditorias no banco' }, { status: 500 });
  }
}
