// inspecionar_views.cjs — lê as views do banco e exibe
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    // Listar tabelas e views relevantes
    const tabelas = await pool.query(`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_type, table_name
    `);
    console.log('=== TABELAS E VIEWS NO BANCO ===');
    tabelas.rows.forEach(r => console.log(`  [${r.table_type}] ${r.table_name}`));

    // Mostrar definição das views
    const views = await pool.query(`
      SELECT table_name, view_definition
      FROM information_schema.views
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log('\n=== DEFINIÇÃO DAS VIEWS ===');
    views.rows.forEach(r => {
      console.log(`\n-- VIEW: ${r.table_name}`);
      console.log(r.view_definition);
    });

    // Verificar se existe tabela curva_abc
    const tabelaCurva = tabelas.rows.find(r => r.table_name === 'curva_abc');
    if (tabelaCurva) {
      const cols = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'curva_abc'
        ORDER BY ordinal_position
      `);
      console.log('\n=== COLUNAS DA TABELA curva_abc ===');
      cols.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));
      const sample = await pool.query(`SELECT * FROM curva_abc LIMIT 3`);
      console.log('\n=== AMOSTRA curva_abc ===');
      console.log(sample.rows);
    }

  } catch (e) {
    console.error('Erro:', e.message);
  } finally {
    await pool.end();
  }
}

run();
