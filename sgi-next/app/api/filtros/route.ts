import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    const query = `
      SELECT DISTINCT cidade, contrato 
      FROM de_para_projeto 
      ORDER BY cidade ASC, contrato ASC
    `;
    const result = await pool.query(query);

    const estadosMap = new Map<string, { sigla: string; nome: string }>();
    const almoxarifados: Record<string, Array<{ codigo: string; label: string; cidade: string; contrato: number }>> = {};
    const codigosVistos = new Set<string>();

    result.rows.forEach((row) => {
      const cidade = row.cidade ? row.cidade.trim() : '';
      const contrato = row.contrato;

      if (!cidade || !contrato) return;
      
      const codigo = `${cidade}|${contrato}`;
      if (codigosVistos.has(codigo)) return;
      codigosVistos.add(codigo);

      let ufSigla = 'RJ';
      let ufNome = 'Rio de Janeiro';
      const cidadeUpper = cidade.toUpperCase();

      if (cidadeUpper === 'ESPIRITO SANTO') { ufSigla = 'ES'; ufNome = 'Espírito Santo'; }
      else if (cidadeUpper === 'SÃO PAULO') { ufSigla = 'SP'; ufNome = 'São Paulo'; }
      else if (cidadeUpper === 'CURITIBA') { ufSigla = 'PR'; ufNome = 'Paraná'; }
      else if (cidadeUpper === 'MINAS GERAIS') { ufSigla = 'MG'; ufNome = 'Minas Gerais'; }

      if (!estadosMap.has(ufSigla)) {
        estadosMap.set(ufSigla, { sigla: ufSigla, nome: ufNome });
      }

      if (!almoxarifados[ufSigla]) almoxarifados[ufSigla] = [];

      almoxarifados[ufSigla].push({
        codigo,
        label: `${cidade} - CONTRATO: ${contrato}`,
        cidade,
        contrato,
      });
    });

    const estados = Array.from(estadosMap.values());
    return NextResponse.json({ estados, almoxarifados });
  } catch (err) {
    console.error('❌ Erro no endpoint GET /api/filtros:', err);
    return NextResponse.json({ error: 'Erro ao buscar filtros no banco de dados' }, { status: 500 });
  }
}
