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
    // 1. Get columns
    const cols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'saldo_estoque'
    `);
    console.log("=== SALDO_ESTOQUE COLUMNS ===");
    console.table(cols.rows);

    // 2. Get sample
    const sample = await client.query(`
      SELECT * 
      FROM saldo_estoque 
      LIMIT 3
    `);
    console.log("=== SALDO_ESTOQUE SAMPLE ===");
    console.log(JSON.stringify(sample.rows, null, 2));
    
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
