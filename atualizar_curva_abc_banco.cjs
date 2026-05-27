/**
 * atualizar_curva_abc_banco.cjs
 * 
 * 1. Lê a aba CURVA do curva.xlsx (já com Classificação calculada)
 * 2. Recria a tabela de_para_curva_abc_mov com os novos dados
 * 3. Recria a view vw_estoque_contagem com JOIN correto na nova tabela
 */

const XLSX = require('xlsx');
const path = require('path');
const { Pool } = require('pg');

const FILE_PATH = path.resolve('curva.xlsx');
const SHEET_NAME = 'CURVA';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const startTime = Date.now();

  // ─── FASE 1: Ler curva.xlsx ───────────────────────────────────────────────
  console.log('📂 Lendo arquivo:', FILE_PATH);
  const wb = XLSX.readFile(FILE_PATH);
  const ws = wb.Sheets[SHEET_NAME];
  if (!ws) {
    console.error(`❌ Aba "${SHEET_NAME}" não encontrada.`);
    process.exit(1);
  }

  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const header = data[0];

  const COL_CODIGO       = header.indexOf('Código');
  const COL_CLASSIFICACAO = header.findIndex(h => String(h).toLowerCase().includes('classifica'));

  if (COL_CODIGO === -1 || COL_CLASSIFICACAO === -1) {
    console.error('❌ Colunas "Código" ou "Classificação" não encontradas no cabeçalho.');
    console.error('   Cabeçalho encontrado:', header);
    process.exit(1);
  }

  // Filtrar linhas válidas (tem código E classificação A/B/C)
  const registros = data.slice(1).filter(row => {
    const cod = String(row[COL_CODIGO] || '').trim();
    const cls = String(row[COL_CLASSIFICACAO] || '').trim().toUpperCase();
    return cod && cod.toUpperCase() !== 'TOTAL' && ['A', 'B', 'C'].includes(cls);
  }).map(row => ({
    codmat: String(row[COL_CODIGO]).trim(),
    classe: String(row[COL_CLASSIFICACAO]).trim().toUpperCase(),
  }));

  console.log(`✅ ${registros.length} registros com classificação ABC lidos do Excel`);
  const contA = registros.filter(r => r.classe === 'A').length;
  const contB = registros.filter(r => r.classe === 'B').length;
  const contC = registros.filter(r => r.classe === 'C').length;
  console.log(`   Classe A: ${contA} | Classe B: ${contB} | Classe C: ${contC}`);

  // ─── FASE 2: Atualizar banco de dados ────────────────────────────────────
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 2a. Recriar tabela de_para_curva_abc_mov
    console.log('\n🏗️  Recriando tabela de_para_curva_abc_mov...');
    await client.query(`DROP TABLE IF EXISTS de_para_curva_abc_mov CASCADE`);
    await client.query(`
      CREATE TABLE de_para_curva_abc_mov (
        id SERIAL PRIMARY KEY,
        codmat VARCHAR(100) NOT NULL,
        classe VARCHAR(1) NOT NULL CHECK (classe IN ('A','B','C')),
        UNIQUE(codmat)
      )
    `);

    // 2b. Inserir em lotes de 500
    const BATCH = 500;
    for (let i = 0; i < registros.length; i += BATCH) {
      const lote = registros.slice(i, i + BATCH);
      const values = [];
      const params = [];
      let p = 1;
      lote.forEach(r => {
        values.push(`($${p++}, $${p++})`);
        params.push(r.codmat, r.classe);
      });
      await client.query(
        `INSERT INTO de_para_curva_abc_mov (codmat, classe) VALUES ${values.join(', ')} ON CONFLICT (codmat) DO UPDATE SET classe = EXCLUDED.classe`,
        params
      );
      console.log(`   ⏳ Inseridos ${Math.min(i + BATCH, registros.length)} / ${registros.length}`);
    }
    console.log('✅ Tabela de_para_curva_abc_mov populada com sucesso!');

    // 2c. Recriar a view vw_estoque_contagem com JOIN na nova classificação
    console.log('\n📺 Recriando view vw_estoque_contagem com classeABC...');
    await client.query(`DROP VIEW IF EXISTS vw_estoque_contagem CASCADE`);
    await client.query(`
      CREATE VIEW vw_estoque_contagem AS
      SELECT 
        MAX(se.id)                                    AS id,
        dp.cidade                                     AS origem,
        CAST(se.grupo_codigo AS INTEGER)              AS contrato,
        se.codmat,
        se.descricao,
        MAX(se.unid)                                  AS unidade,
        SUM(se.saldo_estoque)                         AS "saldoAtual",
        MAX(se.valor)                                 AS "precoUnitario",
        MAX(pc.quantidade_contada)                    AS "ultimaContagemFisica",
        CURRENT_DATE                                  AS "ultimaAtualizacao",
        MAX(abc.classe)                               AS "classeABC"
      FROM saldo_estoque se
      JOIN (
        SELECT contrato, MAX(TRIM(cidade)) AS cidade
        FROM de_para_projeto
        GROUP BY contrato
      ) dp ON CAST(se.grupo_codigo AS INTEGER) = dp.contrato
      LEFT JOIN progresso_contagem pc
        ON pc.codmat = se.codmat AND pc.cidade = dp.cidade
      LEFT JOIN de_para_curva_abc_mov abc
        ON abc.codmat = se.codmat
      GROUP BY dp.cidade, CAST(se.grupo_codigo AS INTEGER), se.codmat, se.descricao
    `);
    console.log('✅ View vw_estoque_contagem recriada com sucesso!');

    await client.query('COMMIT');

    // ─── FASE 3: Verificação ──────────────────────────────────────────────
    console.log('\n🔍 Verificando resultado...');
    const check = await client.query(`
      SELECT "classeABC", COUNT(*) as total
      FROM vw_estoque_contagem
      GROUP BY "classeABC"
      ORDER BY "classeABC" NULLS LAST
    `);
    console.log('Distribuição da Curva ABC na view:');
    check.rows.forEach(r => console.log(`   Classe ${r.classeABC || '(sem classe)'}: ${r.total} itens`));

    const total = await client.query(`SELECT COUNT(*) as total FROM vw_estoque_contagem`);
    console.log(`   Total geral na view: ${total.rows[0].total} itens`);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n🎉 CONCLUÍDO EM ${elapsed}s — Banco atualizado com a nova Curva ABC (Pareto)!`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erro — ROLLBACK executado:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
