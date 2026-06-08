import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

// Mapeamento de contrato → UF
const CONTRATO_UF_MAP: Record<number, { sigla: string; nome: string }> = {
  1: { sigla: 'SP', nome: 'São Paulo' },
  21: { sigla: 'RJ', nome: 'Rio de Janeiro' },
  41: { sigla: 'RJ', nome: 'Rio de Janeiro' },
  61: { sigla: 'ES', nome: 'Espírito Santo' },
  62: { sigla: 'ES', nome: 'Espírito Santo' },
  31: { sigla: 'SP', nome: 'São Paulo' },
  58: { sigla: 'MG', nome: 'Minas Gerais' },
  59: { sigla: 'MG', nome: 'Minas Gerais' },
  71: { sigla: 'PR', nome: 'Paraná' },
  72: { sigla: 'PR', nome: 'Paraná' },
};

// Contratos autorizados no sistema
const CONTRATOS_AUTORIZADOS = new Set(Object.keys(CONTRATO_UF_MAP).map(Number));

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

      // Filtrar apenas contratos autorizados
      if (!CONTRATOS_AUTORIZADOS.has(contrato)) return;

      const codigo = `${cidade}|${contrato}`;
      if (codigosVistos.has(codigo)) return;
      codigosVistos.add(codigo);

      const uf = CONTRATO_UF_MAP[contrato];
      if (!uf) return;

      if (!estadosMap.has(uf.sigla)) {
        estadosMap.set(uf.sigla, { sigla: uf.sigla, nome: uf.nome });
      }

      if (!almoxarifados[uf.sigla]) almoxarifados[uf.sigla] = [];

      // Label amigável indicando o tipo de contrato
      const tipoContrato = contrato === 31 ? 'FERRAMENTARIA E SSO' :
        [1, 21, 61, 58, 71].includes(contrato) ? 'FERRAMENTARIA' : 'SSO';

      almoxarifados[uf.sigla].push({
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
