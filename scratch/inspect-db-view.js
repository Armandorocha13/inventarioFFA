const { Pool } = require('pg');
const fs = require('fs');

let dbUrl = '';
try {
  const envFile = fs.readFileSync('c:\\Users\\user\\Desktop\\ARQUVOS\\PPROJETOS PROGRAMAÇÃO\\sistemaInventario\\.env.local', 'utf8');
  const match = envFile.match(/DATABASE_URL=["']?([^"'\n]+)["']?/);
  if (match) dbUrl = match[1];
} catch (e) {
  console.error(e);
}

const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    // 1. Definition of vw_estoque_contagem
    const viewDef = await client.query(`
      SELECT definition 
      FROM pg_views 
      WHERE viewname = 'vw_estoque_contagem'
    `);
    console.log("=== vw_estoque_contagem definition ===");
    console.log(viewDef.rows[0]?.definition);

    // 2. Query distinct values of de_para_projeto to check if we have other entries
    const deParaSP = await client.query(`
      SELECT DISTINCT cidade, contrato, projeto 
      FROM de_para_projeto 
      WHERE cidade ILIKE '%SP%' OR cidade ILIKE '%PAULO%'
    `);
    console.log("\n=== SÃO PAULO de_para_projeto entries ===");
    console.table(deParaSP.rows);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
