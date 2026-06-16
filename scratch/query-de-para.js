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
    const cols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'de_para_projeto'
    `);
    console.table(cols.rows);
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
