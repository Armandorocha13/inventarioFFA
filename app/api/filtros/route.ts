import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

// Mapeamento dinâmico no loop

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
      const contrato = parseInt(row.contrato, 10);

      if (!cidade || !contrato) return;

      const codigo = `${cidade}|${contrato}`;
      if (codigosVistos.has(codigo)) return;
      codigosVistos.add(codigo);

      let ufSigla = 'RJ';
      let ufNome = 'Rio de Janeiro';
      const cityUpper = cidade.toUpperCase();
      
      if (cityUpper === 'ESPIRITO SANTO' || cityUpper === 'ESPÍRITO SANTO') {
        ufSigla = 'ES'; ufNome = 'Espírito Santo';
      } else if (cityUpper === 'SÃO PAULO' || cityUpper === 'SAO PAULO') {
        ufSigla = 'SP'; ufNome = 'São Paulo';
      } else if (cityUpper === 'CURITIBA') {
        ufSigla = 'PR'; ufNome = 'Paraná';
      } else if (cityUpper === 'MINAS GERAIS') {
        ufSigla = 'MG'; ufNome = 'Minas Gerais';
      }

      if (!estadosMap.has(ufSigla)) {
        estadosMap.set(ufSigla, { sigla: ufSigla, nome: ufNome });
      }

      if (!almoxarifados[ufSigla]) almoxarifados[ufSigla] = [];

      // Label amigável indicando o tipo de contrato
      const tipoContrato = contrato === 31 ? 'FERRAMENTARIA E SSO' :
        [21, 61, 58, 71].includes(contrato) ? 'FERRAMENTARIA' : 'SSO';

      almoxarifados[ufSigla].push({
        codigo,
        label: `${cidade} - CONTRATO: ${contrato} (${tipoContrato})`,
        cidade,
        contrato,
      });
    });

    // Ordenar almoxarifados por contrato dentro de cada UF
    for (const uf of Object.keys(almoxarifados)) {
      almoxarifados[uf].sort((a, b) => a.contrato - b.contrato);
    }

    const estados = Array.from(estadosMap.values()).sort((a, b) =>
      a.nome.localeCompare(b.nome)
    );

    return NextResponse.json({ estados, almoxarifados });
  } catch (err) {
    console.error('❌ Erro no endpoint GET /api/filtros:', err);
    return NextResponse.json({ error: 'Erro ao buscar filtros no banco de dados' }, { status: 500 });
  }
}
