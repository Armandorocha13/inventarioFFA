import { NextRequest, NextResponse } from 'next/server';
import { inserirMaterialExtra } from '@/lib/services/materiais.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await inserirMaterialExtra(body);
    return NextResponse.json(res);
  } catch (err: any) {
    console.error('❌ Erro no endpoint POST /api/materiais/extra:', err);
    return NextResponse.json({ error: err.message || 'Erro ao inserir material extra' }, { status: 500 });
  }
}
