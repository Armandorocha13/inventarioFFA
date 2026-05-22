const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const r = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'historico_contagem'");
  console.log(r.rows);
  pool.end();
}
run();
