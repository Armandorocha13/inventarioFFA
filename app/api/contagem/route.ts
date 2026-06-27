import { NextRequest, NextResponse } from 'next/server';
import { gravarContagens, ContagemInvalidaError } from '@/lib/services/contagem.service';

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido no corpo da requisição.' }, { status: 400 });
  }

  try {
    const { count } = await gravarContagens(payload);
    return NextResponse.json({ success: true, count });
  } catch (err) {
    if (err instanceof ContagemInvalidaError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('❌ Erro ao gravar contagens e atualizar estoque:', err);
    return NextResponse.json(
      { error: 'Erro ao gravar as contagens físicas no banco de dados.' },
      { status: 500 }
    );
  }
}
