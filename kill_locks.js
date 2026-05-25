import pg from 'pg';
import fs from 'fs';

const { Pool } = pg;

// Read DATABASE_URL from .env
let databaseUrl = '';
try {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  const match = envFile.match(/DATABASE_URL=["']?([^"'\n]+)["']?/);
  if (match) databaseUrl = match[1];
} catch (e) {
  try {
    const envFile = fs.readFileSync('.env', 'utf8');
    const match = envFile.match(/DATABASE_URL=["']?([^"'\n]+)["']?/);
    if (match) databaseUrl = match[1];
  } catch(e) {}
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log("Connecting...");
  const client = await pool.connect();
  console.log("Connected! Running query to check active processes...");
  
  const res = await client.query(`
    SELECT pid, query, state, age(clock_timestamp(), query_start) 
    FROM pg_stat_activity 
    WHERE state != 'idle' AND pid != pg_backend_pid()
  `);
  console.log("Active processes:", res.rows);

  console.log("Terminating hanging processes...");
  for (const row of res.rows) {
    if (row.query.includes("de_para_curva_abc") || row.state === 'idle in transaction') {
      console.log(`Killing pid ${row.pid} running: ${row.query}`);
      await client.query("SELECT pg_terminate_backend($1)", [row.pid]);
    }
  }

  client.release();
  await pool.end();
  console.log("Done checking/killing locks.");
}

run().catch(console.error);
