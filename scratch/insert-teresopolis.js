const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
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
  const client = await pool.connect();
  try {
    console.log("=== Inserting Teresopolis into de_para_projeto table ===");
    
    const entries = [
      { contrato: 21, cidade: 'RIO DE JANEIRO', projeto: 'CLARO TERESOPOLIS' },
      { contrato: 34, cidade: 'RIO DE JANEIRO', projeto: 'CLARO TERESOPOLIS' },
      { contrato: 41, cidade: 'RIO DE JANEIRO', projeto: 'SEG TERESÓPOLIS' }
    ];

    for (const entry of entries) {
      // Check if entry already exists
      const checkRes = await client.query(
        'SELECT id FROM de_para_projeto WHERE contrato = $1 AND projeto = $2',
        [entry.contrato, entry.projeto]
      );
      
      if (checkRes.rows.length === 0) {
        await client.query(
          'INSERT INTO de_para_projeto (contrato, cidade, projeto) VALUES ($1, $2, $3)',
          [entry.contrato, entry.cidade, entry.projeto]
        );
        console.log(`Inserted to DB: Contract ${entry.contrato} - ${entry.projeto}`);
      } else {
        console.log(`Already exists in DB: Contract ${entry.contrato} - ${entry.projeto}`);
      }
    }

    // Now update Excel sheet deParaProjeto.xlsx
    const excelPath = path.join('c:', 'Users', 'user', 'Desktop', 'ARQUVOS', 'PPROJETOS PROGRAMAÇÃO', 'sistemaInventario', 'docs', 'planilhas', 'deParaProjeto.xlsx');
    console.log("Updating Excel file:", excelPath);
    
    if (fs.existsSync(excelPath)) {
      const workbook = XLSX.readFile(excelPath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet);

      let updated = false;
      for (const entry of entries) {
        const exists = rows.some(r => {
          return String(r.CONTRATO) === String(entry.contrato) && 
                 String(r.PROJETO).toUpperCase() === entry.projeto.toUpperCase();
        });

        if (!exists) {
          rows.push({
            CONTRATO: entry.contrato,
            CIDADE: entry.cidade,
            PROJETO: entry.projeto
          });
          updated = true;
          console.log(`Added to Excel: Contract ${entry.contrato} - ${entry.projeto}`);
        }
      }

      if (updated) {
        // Write the workbook back
        const newSheet = XLSX.utils.json_to_sheet(rows);
        workbook.Sheets[sheetName] = newSheet;
        XLSX.writeFile(workbook, excelPath);
        console.log("Excel file saved successfully.");
      } else {
        console.log("Excel file is already up to date.");
      }
    } else {
      console.warn("Excel file not found at path:", excelPath);
    }

  } catch (err) {
    console.error("Error during insertion:", err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
