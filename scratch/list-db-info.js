const { Pool } = require('c:\\Users\\user\\Desktop\\ARQUVOS\\PPROJETOS PROGRAMAÇÃO\\sistemaInventario\\node_modules\\pg');
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
    // 1. Row counts of each table
    const tables = ['saldo_estoque', 'de_para_curva_abc_mov', 'de_para_projeto', 'progresso_contagem'];
    for (const t of tables) {
      const countRes = await client.query(`SELECT COUNT(*) FROM ${t}`);
      console.log(`Table ${t}: ${countRes.rows[0].count} rows`);
    }

    // 2. Query columns and sample of de_para_curva_abc_mov
    console.log("\n=== de_para_curva_abc_mov columns ===");
    const cols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'de_para_curva_abc_mov'
    `);
    console.table(cols.rows);

    console.log("\n=== de_para_curva_abc_mov sample ===");
    const sample = await client.query(`SELECT * FROM de_para_curva_abc_mov LIMIT 5`);
    console.table(sample.rows);
    
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
