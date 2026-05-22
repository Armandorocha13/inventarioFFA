const fs = require('fs');
const { Pool } = require('pg');

let dbUrl = '';
try {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  const match = envFile.match(/DATABASE_URL=["']?([^"'\n]+)["']?/);
  if (match) dbUrl = match[1];
} catch (e) {
  try {
    const envFile = fs.readFileSync('.env', 'utf8');
    const match = envFile.match(/DATABASE_URL=["']?([^"'\n]+)["']?/);
    if (match) dbUrl = match[1];
  } catch(e) {}
}

if (!dbUrl) {
  console.error("DATABASE_URL nao encontrada");
  process.exit(1);
}

const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Drop old table
    console.log("Dropping historico_contagem...");
    await client.query('DROP TABLE IF EXISTS historico_contagem CASCADE;');

    // 2. Create new table
    console.log("Creating progresso_contagem...");
    await client.query(`
      CREATE TABLE progresso_contagem (
        id SERIAL PRIMARY KEY,
        cidade VARCHAR(255),
        codmat VARCHAR(255),
        quantidade_contada NUMERIC,
        atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (cidade, codmat)
      );
    `);

    // 3. Create view
    console.log("Creating view vw_estoque_contagem...");
    await client.query(`
      CREATE OR REPLACE VIEW vw_estoque_contagem AS
      SELECT 
        MAX(se.id) as id,
        dp.cidade AS origem,
        CAST(se.grupo_codigo AS INTEGER) as contrato,
        se.codmat,
        se.descricao,
        MAX(se.unid) AS unidade,
        SUM(se.saldo_disponivel) AS "saldoAtual",
        MAX(se.valor) AS "precoUnitario",
        MAX(pc.quantidade_contada) AS "ultimaContagemFisica"
      FROM saldo_estoque se
      JOIN (SELECT contrato, MAX(TRIM(cidade)) as cidade FROM de_para_projeto GROUP BY contrato) dp 
        ON CAST(se.grupo_codigo AS INTEGER) = dp.contrato
      LEFT JOIN progresso_contagem pc 
        ON pc.codmat = se.codmat AND pc.cidade = dp.cidade
      GROUP BY dp.cidade, CAST(se.grupo_codigo AS INTEGER), se.codmat, se.descricao;
    `);

    await client.query('COMMIT');
    console.log("Migration completed successfully.");
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Migration failed:", err);
  } finally {
    client.release();
    pool.end();
  }
}

runMigration();
