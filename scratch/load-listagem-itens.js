const { Pool } = require('c:\\Users\\user\\Desktop\\ARQUVOS\\PPROJETOS PROGRAMAÇÃO\\sistemaInventario\\node_modules\\pg');
const fs = require('fs');
const XLSX = require('xlsx');

let dbUrl = '';
try {
  const envFile = fs.readFileSync('c:\\Users\\user\\Desktop\\ARQUVOS\\PPROJETOS PROGRAMAÇÃO\\sistemaInventario\\.env.local', 'utf8');
  const match = envFile.match(/DATABASE_URL=["']?([^"'\n]+)["']?/);
  if (match) dbUrl = match[1];
} catch (e) {
  try {
    const envFile = fs.readFileSync('c:\\Users\\user\\Desktop\\ARQUVOS\\PPROJETOS PROGRAMAÇÃO\\sistemaInventario\\.env', 'utf8');
    const match = envFile.match(/DATABASE_URL=["']?([^"'\n]+)["']?/);
    if (match) dbUrl = match[1];
  } catch (e) {}
}

if (!dbUrl) {
  console.error("DATABASE_URL nao encontrada!");
  process.exit(1);
}

const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function run() {
  const filePath = 'c:\\Users\\user\\Desktop\\ARQUVOS\\PPROJETOS PROGRAMAÇÃO\\sistemaInventario\\listagem.xlsx';
  if (!fs.existsSync(filePath)) {
    console.error(`Arquivo nao encontrado: ${filePath}`);
    process.exit(1);
  }

  console.log("Lendo arquivo Excel...");
  const workbook = XLSX.readFile(filePath);
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
  console.log(`Linhas lidas do Excel: ${data.length}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log("Garantindo estrutura da tabela de_para_itens...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS de_para_itens (
        id SERIAL PRIMARY KEY,
        grupo VARCHAR(255),
        codmat VARCHAR(255),
        UNIQUE(grupo, codmat)
      )
    `);

    console.log("Limpando dados antigos da tabela de_para_itens...");
    await client.query('TRUNCATE de_para_itens RESTART IDENTITY');

    // Prepara arrays para insercao em massa
    const grupos = [];
    const codmats = [];
    const seen = new Set();

    for (const row of data) {
      const g = row.Grupo ? String(row.Grupo).trim() : '';
      const c = row.Codmat ? String(row.Codmat).trim() : '';

      if (!g || !c) continue;

      // Evita duplicatas na inserção para respeitar o UNIQUE constraint
      const key = `${g}|${c}`;
      if (seen.has(key)) continue;
      seen.add(key);

      grupos.push(g);
      codmats.push(c);
    }

    console.log(`Inserindo ${grupos.length} itens unicos...`);
    await client.query(
      'INSERT INTO de_para_itens (grupo, codmat) SELECT * FROM UNNEST($1::VARCHAR[], $2::VARCHAR[])',
      [grupos, codmats]
    );

    await client.query('COMMIT');
    console.log("Inclusao dos itens da listagem realizada com sucesso!");
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Erro na execucao da carga:", err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
