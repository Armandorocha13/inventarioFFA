import XLSX from 'xlsx';
import pg from 'pg';
import fs from 'fs';

const { Pool } = pg;

// Read DATABASE_URL from environment/files
let databaseUrl = '';
try {
  let envFile = '';
  if (fs.existsSync('sgi-next/.env.local')) {
    envFile = fs.readFileSync('sgi-next/.env.local', 'utf8');
  } else if (fs.existsSync('sgi-next/.env')) {
    envFile = fs.readFileSync('sgi-next/.env', 'utf8');
  } else if (fs.existsSync('.env.local')) {
    envFile = fs.readFileSync('.env.local', 'utf8');
  } else if (fs.existsSync('.env')) {
    envFile = fs.readFileSync('.env', 'utf8');
  }
  const match = envFile.match(/DATABASE_URL=["']?([^"'\n\r]+)["']?/);
  if (match) databaseUrl = match[1];
} catch (e) {}

if (!databaseUrl) {
  console.error("DATABASE_URL not found in .env or .env.local");
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});

function parseExcelDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'number') {
    // Excel serial number conversion
    return new Date(Math.round((val - 25569) * 86400 * 1000));
  }
  if (typeof val === 'string') {
    const parts = val.trim().split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // 0-based month
      const year = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month, day);
      }
    }
  }
  return null;
}

async function run() {
  console.log("Loading conferenciaMovimento.xlsx...");
  const workbook = XLSX.readFile('conferenciaMovimento.xlsx');
  const sheetName = workbook.SheetNames[0];
  console.log(`Using sheet: ${sheetName}`);
  const worksheet = workbook.Sheets[sheetName];
  
  console.log("Parsing rows...");
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  console.log(`Total rows parsed: ${rows.length}`);
  
  if (rows.length < 3) {
    console.error("Insufficient rows in excel sheet");
    process.exit(1);
  }
  
  // Find indices based on Row 2 (the headers row)
  const headers = rows[2].map(h => String(h || '').trim().toLowerCase());
  
  // Find "código" (material code) columns
  // The first "Código" is at index 5 (CC), the second "Código" is at index 8 (Material code)
  // Let's explicitly search for column indices
  const dateIdx = headers.indexOf('data movimentação');
  
  // Find second "código"
  let matCodeIdx = -1;
  let codeCount = 0;
  for (let i = 0; i < headers.length; i++) {
    if (headers[i] === 'código') {
      codeCount++;
      if (codeCount === 2) {
        matCodeIdx = i;
      }
    }
  }
  
  // Fallbacks if columns are not found by strict name
  const finalDateIdx = dateIdx !== -1 ? dateIdx : 7;
  const finalMatCodeIdx = matCodeIdx !== -1 ? matCodeIdx : 8;
  
  console.log(`Column configuration: Date Index = ${finalDateIdx}, Material Code Index = ${finalMatCodeIdx}`);
  
  // Store last movement date for each material
  const lastMovDates = new Map();
  
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    
    const matCode = row[finalMatCodeIdx] ? String(row[finalMatCodeIdx]).trim() : '';
    const dateVal = row[finalDateIdx];
    
    if (!matCode) continue;
    
    const movDate = parseExcelDate(dateVal);
    if (!movDate) continue;
    
    const currentMax = lastMovDates.get(matCode);
    if (!currentMax || movDate > currentMax) {
      lastMovDates.set(matCode, movDate);
    }
  }
  
  console.log(`Processed ${lastMovDates.size} unique materials with movements.`);
  
  // Reference Dates relative to 25/05/2026
  const REF_DATE = new Date(2026, 4, 25); // May 25, 2026
  const THRESHOLD_30_DAYS = new Date(2026, 3, 25); // April 25, 2026
  const THRESHOLD_90_DAYS = new Date(2026, 1, 24); // February 24, 2026
  
  console.log("Applying threshold rules...");
  console.log(`- Class A (Recent): Last movement >= ${THRESHOLD_30_DAYS.toLocaleDateString('pt-BR')}`);
  console.log(`- Class B (Medium): Last movement >= ${THRESHOLD_90_DAYS.toLocaleDateString('pt-BR')} and < ${THRESHOLD_30_DAYS.toLocaleDateString('pt-BR')}`);
  console.log(`- Class C (Old): Last movement < ${THRESHOLD_90_DAYS.toLocaleDateString('pt-BR')}`);
  
  const classifications = [];
  let aCount = 0;
  let bCount = 0;
  let cCount = 0;
  
  for (const [matCode, maxDate] of lastMovDates.entries()) {
    let classe = 'C';
    if (maxDate >= THRESHOLD_30_DAYS) {
      classe = 'A';
      aCount++;
    } else if (maxDate >= THRESHOLD_90_DAYS) {
      classe = 'B';
      bCount++;
    } else {
      classe = 'C';
      cCount++;
    }
    classifications.push({
      codmat: matCode,
      classe: classe,
      ultima_mov: maxDate.toISOString().split('T')[0]
    });
  }
  
  console.log(`Classification distribution: A = ${aCount}, B = ${bCount}, C = ${cCount}`);
  
  console.log("Connecting to PostgreSQL...");
  const client = await pool.connect();
  
  try {
    // 1. Create table de_para_curva_abc_mov
    console.log("🏗️ Creating table de_para_curva_abc_mov...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS de_para_curva_abc_mov (
        codmat VARCHAR(50) PRIMARY KEY,
        classe VARCHAR(5) NOT NULL,
        ultima_movimentacao DATE
      );
    `);
    
    // 2. Clear old mapping
    console.log("🧹 Clearing old classification mapping...");
    await client.query('TRUNCATE TABLE de_para_curva_abc_mov;');
    
    // 3. Batch insert in chunks of 200
    console.log("📥 Loading classifications into database...");
    const BATCH_SIZE = 200;
    await client.query('BEGIN');
    
    for (let i = 0; i < classifications.length; i += BATCH_SIZE) {
      const chunk = classifications.slice(i, i + BATCH_SIZE);
      const values = [];
      const placeholders = [];
      
      chunk.forEach((item, index) => {
        const baseIndex = index * 3;
        placeholders.push(`($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3})`);
        values.push(item.codmat, item.classe, item.ultima_mov);
      });
      
      const queryText = `
        INSERT INTO de_para_curva_abc_mov (codmat, classe, ultima_movimentacao)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (codmat) DO UPDATE 
        SET classe = EXCLUDED.classe, ultima_movimentacao = EXCLUDED.ultima_movimentacao
      `;
      
      await client.query(queryText, values);
    }
    
    await client.query('COMMIT');
    console.log(`✅ Loaded ${classifications.length} records successfully.`);
    
    // 4. Create View vw_curva_abc
    console.log("📺 Creating/updating View vw_curva_abc...");
    await client.query(`
      CREATE OR REPLACE VIEW vw_curva_abc AS
      SELECT DISTINCT
        se.descricao AS nome_item,
        se.codmat AS codigo,
        COALESCE(map.classe, 'C') AS classe_abc
      FROM saldo_estoque se
      LEFT JOIN de_para_curva_abc_mov map ON se.codmat = map.codmat;
    `);
    console.log("✅ View vw_curva_abc created!");
    
    // 5. Update main view vw_estoque_contagem
    console.log("📺 Updating main View vw_estoque_contagem...");
    await client.query(`DROP VIEW IF EXISTS vw_estoque_contagem CASCADE`);
    await client.query(`
      CREATE VIEW vw_estoque_contagem AS
      SELECT 
        MAX(se.id) as id,
        dp.cidade AS origem,
        CAST(se.grupo_codigo AS INTEGER) as contrato,
        se.codmat,
        se.descricao,
        MAX(se.unid) AS unidade,
        SUM(se.saldo_disponivel) AS "saldoAtual",
        MAX(se.valor) AS "precoUnitario",
        MAX(pc.quantidade_contada) AS "ultimaContagemFisica",
        COALESCE(MAX(map.classe), 'C') AS "classeABC"
      FROM saldo_estoque se
      JOIN (SELECT contrato, MAX(TRIM(cidade)) as cidade FROM de_para_projeto GROUP BY contrato) dp 
        ON CAST(se.grupo_codigo AS INTEGER) = dp.contrato
      LEFT JOIN progresso_contagem pc 
        ON pc.codmat = se.codmat AND pc.cidade = dp.cidade
      LEFT JOIN de_para_curva_abc_mov map 
        ON se.codmat = map.codmat
      GROUP BY dp.cidade, CAST(se.grupo_codigo AS INTEGER), se.codmat, se.descricao;
    `);
    console.log("✅ View vw_estoque_contagem updated!");
    
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch(e) {}
    console.error("❌ Database operation failed:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
