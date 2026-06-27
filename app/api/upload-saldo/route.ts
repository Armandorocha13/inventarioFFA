import { NextRequest, NextResponse } from 'next/server';
import { importarSaldo, UploadInvalidoError } from '@/lib/services/upload.service';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { insertedCount, syncedCount } = await importarSaldo(buffer);

    return NextResponse.json({
      success: true,
      message: 'Tabela saldo_estoque atualizada com sucesso!',
      insertedCount,
      syncedCount,
    });
  } catch (err) {
    if (err instanceof UploadInvalidoError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('❌ Erro no endpoint POST /api/upload-saldo:', err);
    return NextResponse.json({ error: `Erro no servidor: ${message}` }, { status: 500 });
  }
}
