import pg from 'pg';
import fs from 'fs';
import path from 'path';

// read env from .env since process.env doesn't load it automatically here without dotenv
const envStr = fs.readFileSync('.env', 'utf-8');
const dbUrlMatch = envStr.match(/DATABASE_URL=(.*)/);
const connectionString = dbUrlMatch ? dbUrlMatch[1].trim() : process.env.DATABASE_URL;

const { Client } = pg;
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function run() {
  await client.connect();
  console.log('Connected');
  
  // Test JOIN
  const res = await client.query(`
    SELECT se.grupo_codigo, dp.contrato, dp.cidade, COUNT(se.id) as items
    FROM saldo_estoque se
    LEFT JOIN de_para_projeto dp ON CAST(se.grupo_codigo AS INTEGER) = dp.contrato
    GROUP BY se.grupo_codigo, dp.contrato, dp.cidade
    ORDER BY se.grupo_codigo
    LIMIT 10
  `);
  console.log('JOIN result:', res.rows);
  
  // Check historico_contagem
  const hist = await client.query('SELECT * FROM historico_contagem');
  console.log('Historico count:', hist.rows.length);

  await client.end();
}

run().catch(console.error);
