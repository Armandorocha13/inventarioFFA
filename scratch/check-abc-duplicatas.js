/**
 * check-abc-duplicatas.js
 * Verifica se algum codmat aparece em múltiplas classes da Curva ABC.
 * A classificação é simulada aqui com a mesma lógica do AppScreen.tsx:
 *   - Ordena todos os itens por valorEstoque (saldo * preço)
 *   - Acumula até 80% → Classe A
 *   - 80–95% → Classe B
 *   - >95% → Classe C
 *
 * Roda com: node scratch/check-abc-duplicatas.js
 */

const { Pool } = require('pg');
const fs = require('fs');

let dbUrl = '';
try {
  const envFile = fs.readFileSync('c:\\Users\\user\\Desktop\\ARQUVOS\\PPROJETOS PROGRAMAÇÃO\\sistemaInventario\\.env.local', 'utf8');
  const match = envFile.match(/DATABASE_URL=["']?([^"'\n]+)["']?/);
  if (match) dbUrl = match[1];
} catch (e) {
  console.error('Erro ao ler .env.local:', e.message);
}

const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

const CONTRATOS = [1, 21, 41, 61, 62, 31, 58, 59, 71, 72];

async function main() {
  const client = await pool.connect();
  try {
    // 1. Busca todos os materiais (mesma query da API)
    const { rows } = await client.query(`
      SELECT
        MAX(se.id) AS id,
        dp.cidade AS origem,
        CAST(se.grupo_codigo AS INTEGER) AS contrato,
        se.grupo,
        se.codmat,
        se.descricao,
        SUM(se.saldo_estoque) AS "saldoAtual",
        MAX(se.valor) AS "precoUnitario"
      FROM saldo_estoque se
      JOIN (
        SELECT contrato, MAX(TRIM(cidade)) AS cidade
        FROM de_para_projeto GROUP BY contrato
      ) dp ON CAST(se.grupo_codigo AS INTEGER) = dp.contrato
      JOIN de_para_itens dpi
        ON se.grupo = dpi.grupo AND se.codmat = dpi.codmat
      WHERE se.codmat NOT ILIKE 'S%'
        AND se.descricao NOT ILIKE 'SUC-%'
        AND COALESCE(se.codcpl, '') NOT ILIKE '%SUCATA%'
        AND NOT (CAST(se.grupo_codigo AS INTEGER) = 1 AND se.grupo ILIKE '%RJO%')
        AND CAST(se.grupo_codigo AS INTEGER) = ANY($1::int[])
        AND descricao NOT ILIKE 'DET-%'
        AND descricao NOT ILIKE 'REAP-%'
        AND descricao NOT ILIKE 'DEF-%'
      GROUP BY dp.cidade, CAST(se.grupo_codigo AS INTEGER), se.grupo, se.codmat, se.descricao
      ORDER BY descricao
    `, [CONTRATOS]);

    console.log(`\n📦 Total de linhas carregadas: ${rows.length}\n`);

    // 2. Simula classificação ABC (igual AppScreen.tsx)
    const itens = rows.map(r => ({
      id: Number(r.id),
      codmat: r.codmat?.trim(),
      descricao: r.descricao?.trim(),
      grupo: r.grupo?.trim(),
      saldoAtual: parseFloat(r.saldoAtual) || 0,
      precoUnitario: parseFloat(r.precoUnitario) || 0,
      valorEstoque: (parseFloat(r.saldoAtual) || 0) * (parseFloat(r.precoUnitario) || 0),
    }));

    itens.sort((a, b) => b.valorEstoque - a.valorEstoque);
    const totalValor = itens.reduce((acc, i) => acc + i.valorEstoque, 0);

    let soma = 0;
    const classeMap = new Map(); // id → classe
    for (const item of itens) {
      soma += item.valorEstoque;
      const pct = totalValor > 0 ? soma / totalValor : 0;
      const classe = pct <= 0.80 ? 'A' : pct <= 0.95 ? 'B' : 'C';
      classeMap.set(item.id, classe);
      item.classeABC = classe;
    }

    // 3. Agrupar por codmat e checar se há mais de uma classe
    const porCodmat = new Map(); // codmat → Set<classe>
    const detalhesCodmat = new Map(); // codmat → lista de { descricao, grupo, classeABC, valorEstoque }

    for (const item of itens) {
      if (!porCodmat.has(item.codmat)) {
        porCodmat.set(item.codmat, new Set());
        detalhesCodmat.set(item.codmat, []);
      }
      porCodmat.get(item.codmat).add(item.classeABC);
      detalhesCodmat.get(item.codmat).push({
        descricao: item.descricao,
        grupo: item.grupo,
        classeABC: item.classeABC,
        valorEstoque: item.valorEstoque,
      });
    }

    // 4. Filtra apenas os que têm múltiplas classes
    const duplicatas = [];
    for (const [codmat, classes] of porCodmat.entries()) {
      if (classes.size > 1) {
        duplicatas.push({ codmat, classes: [...classes].sort(), itens: detalhesCodmat.get(codmat) });
      }
    }

    if (duplicatas.length === 0) {
      console.log('✅ Nenhuma duplicata encontrada! Todos os codmats estão em uma única classe ABC.\n');
    } else {
      console.log(`⚠️  ${duplicatas.length} codmat(s) aparecem em múltiplas classes ABC:\n`);
      console.log('─'.repeat(100));

      for (const { codmat, classes, itens: itensDup } of duplicatas) {
        console.log(`\nCODMAT: ${codmat} | Classes: [${classes.join(', ')}]`);
        for (const i of itensDup) {
          const val = i.valorEstoque.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          console.log(`  [${i.classeABC}] ${i.grupo.padEnd(40)} ${i.descricao.padEnd(50)} ${val}`);
        }
      }

      console.log('\n' + '─'.repeat(100));
      console.log(`\n📊 Resumo:\n`);
      const contPorPar = {};
      for (const { classes } of duplicatas) {
        const key = classes.join('+');
        contPorPar[key] = (contPorPar[key] || 0) + 1;
      }
      for (const [par, count] of Object.entries(contPorPar)) {
        console.log(`  Classes ${par}: ${count} codmat(s)`);
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
