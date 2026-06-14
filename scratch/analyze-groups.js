const { Pool } = require('c:\\Users\\user\\Desktop\\ARQUVOS\\PPROJETOS PROGRAMAÇÃO\\sistemaInventario\\node_modules\\pg');
const fs = require('fs');
const XLSX = require('xlsx');

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
  const filePath = 'c:\\Users\\user\\Desktop\\ARQUVOS\\PPROJETOS PROGRAMAÇÃO\\sistemaInventario\\listagem.xlsx';
  const workbook = XLSX.readFile(filePath);
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
  
  const client = await pool.connect();
  try {
    console.log(`Excel rows count: ${data.length}`);
    
    // We create a temp table
    await client.query('CREATE TEMP TABLE IF NOT EXISTS temp_excel_items (grupo VARCHAR(255), codmat VARCHAR(255))');
    await client.query('TRUNCATE temp_excel_items');
    
    // Extract arrays for UNNEST
    const grupos = data.map(r => r.Grupo ? String(r.Grupo).trim() : '');
    const codmats = data.map(r => r.Codmat ? String(r.Codmat).trim() : '');
    
    // Perform bulk insert using UNNEST
    await client.query(
      'INSERT INTO temp_excel_items (grupo, codmat) SELECT * FROM UNNEST($1::VARCHAR[], $2::VARCHAR[])',
      [grupos, codmats]
    );
    
    const checkRes = await client.query(`
      SELECT COUNT(*) as cnt 
      FROM temp_excel_items t
      JOIN saldo_estoque se ON se.grupo = t.grupo AND se.codmat = t.codmat
    `);
    console.log(`Matched rows with saldo_estoque: ${checkRes.rows[0].cnt} out of ${data.length}`);
    
    const checkViewRes = await client.query(`
      SELECT COUNT(*) as cnt 
      FROM temp_excel_items t
      JOIN vw_estoque_contagem se ON se.grupo = t.grupo AND se.codmat = t.codmat
    `);
    console.log(`Matched rows with vw_estoque_contagem: ${checkViewRes.rows[0].cnt} out of ${data.length}`);
    
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
