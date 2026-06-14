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

const ALIAS_CIDADE = {
  "FERRAM.CLARO IAT": "NOVA FRIBURGO",
  "FRIBURGO": "NOVA FRIBURGO",
  "N FRIBURGO": "NOVA FRIBURGO",
  "N. FRIBURGO": "NOVA FRIBURGO",
  "NVA FRIBURGO": "NOVA FRIBURGO",
  "N.FRIBURGO": "NOVA FRIBURGO",
  "SEG NOVA FRIBURGO": "NOVA FRIBURGO",
  "REGULADOR FRIBURGO": "NOVA FRIBURGO",
};

function padronizarNomeCidade(grupoOriginal) {
  if (!grupoOriginal) return '';
  const comPrefixo = grupoOriginal.trim().toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, "")
    .replace(/\.\s+/g, '.');
  if (ALIAS_CIDADE[comPrefixo]) return ALIAS_CIDADE[comPrefixo];

  let nome = '';
  const idxEspaco = grupoOriginal.indexOf(' ');
  if (idxEspaco !== -1) {
    nome = grupoOriginal.substring(idxEspaco + 1).trim().toUpperCase();
  } else {
    nome = grupoOriginal.replace(/^\d+\//, '').trim().toUpperCase();
  }
  nome = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\.\s+/g, '.');

  if (ALIAS_CIDADE[nome]) return ALIAS_CIDADE[nome];

  const semPrefixo = grupoOriginal.replace(/^\d+\//, '').trim().toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, "")
    .replace(/\.\s+/g, '.');
  if (ALIAS_CIDADE[semPrefixo]) return ALIAS_CIDADE[semPrefixo];

  return nome;
}

async function run() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT * FROM vw_estoque_contagem');
    console.log(`Total rows: ${res.rows.length}`);
    
    // Group by normalized city
    const stats = {};
    for (const row of res.rows) {
      const city = padronizarNomeCidade(row.grupo || '') || 'OUTRAS';
      if (!stats[city]) {
        stats[city] = { total: 0, contados: 0, acertos: 0 };
      }
      stats[city].total++;
      if (row.ultimaContagemFisica !== null && row.ultimaContagemFisica !== undefined) {
        stats[city].contados++;
        if (parseFloat(row.ultimaContagemFisica) === parseFloat(row.saldoAtual)) {
          stats[city].acertos++;
        }
      }
    }
    
    console.log("Stats per city:");
    console.table(Object.entries(stats).map(([city, s]) => ({
      City: city,
      Total: s.total,
      Contados: s.contados,
      Acertos: s.acertos,
      Accuracy: s.contados > 0 ? Math.round((s.acertos / s.contados) * 100) + '%' : 'N/A'
    })).sort((a,b) => b.Contados - a.Contados));
    
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
