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
    const res = await client.query(`
      SELECT DISTINCT contrato, projeto 
      FROM de_para_projeto 
      WHERE cidade = 'SÃO PAULO'
      ORDER BY contrato, projeto
    `);
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
