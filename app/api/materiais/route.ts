import { NextRequest, NextResponse } from 'next/server';
import { listarMateriais } from '@/lib/services/materiais.service';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  try {
    const materiais = await listarMateriais({
      cidade: searchParams.get('cidade'),
      contrato: searchParams.get('contrato'),
      projeto: searchParams.get('projeto'),
    });
    return NextResponse.json(materiais);
  } catch (err) {
    console.error('❌ Erro no endpoint GET /api/materiais:', err);
    return NextResponse.json({ error: 'Erro ao buscar materiais no banco de dados' }, { status: 500 });
  }
}
