import pg from 'pg';
const { Client } = pg;

const TABLE_NAME = 'de_para_projeto';

async function verify() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL não encontrada no .env');
    process.exit(1);
  }

  console.log('🔌 Conectando ao Neon DB para verificação do De-Para...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Conectado.');

    // 1. Auditar as colunas da tabela no banco de dados para confirmar a estrutura dinâmica
    console.log('\n🔍 Auditando as colunas da tabela "de_para_projeto" no Neon...');
    const columnsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = $1 
      ORDER BY ordinal_position
    `, [TABLE_NAME]);

    const schemaColumns = columnsRes.rows.map(r => r.column_name);
    console.log(`✨ Estrutura da tabela "${TABLE_NAME}" no banco (${schemaColumns.length} colunas encontradas):`);
    console.table(columnsRes.rows);

    // 2. Verificar total de registros lidos
    console.log('\n📊 Verificando contagem de dados...');
    const countRes = await client.query(`SELECT COUNT(*) FROM ${TABLE_NAME}`);
    const totalRows = countRes.rows[0].count;
    console.log(`📊 Total de registros salvos na tabela "${TABLE_NAME}": ${totalRows}`);

    if (Number(totalRows) === 92) {
      console.log('💚 Sucesso! A contagem de linhas corresponde exatamente às 92 linhas de dados válidos da planilha.');
    } else {
      console.error(`❌ Erro! Esperávamos 92 registros, mas encontramos ${totalRows}.`);
    }

    // 3. Exibir amostra dos 5 primeiros registros importados
    console.log('\n👀 Amostra dos 5 primeiros registros importados:');
    const sampleRes = await client.query(`
      SELECT id, contrato, cidade, projeto 
      FROM ${TABLE_NAME} 
      ORDER BY id ASC 
      LIMIT 5
    `);
    console.table(sampleRes.rows);

    // 4. Testar a performance da coluna indexada "contrato"
    const sampleContrato = sampleRes.rows[0]?.contrato;
    if (sampleContrato !== undefined) {
      console.log(`\n⚡ Testando query indexada para o contrato: "${sampleContrato}"`);
      const searchStart = Date.now();
      const searchRes = await client.query(`
        SELECT id, cidade, projeto 
        FROM ${TABLE_NAME} 
        WHERE contrato = $1
      `, [sampleContrato]);
      const searchDuration = Date.now() - searchStart;
      console.log(`✅ Busca retornou ${searchRes.rows.length} resultados em ${searchDuration}ms.`);
    }

  } catch (err) {
    console.error('💥 Erro ao executar verificação do De-Para:', err);
  } finally {
    await client.end();
    console.log('🔌 Conexão finalizada.');
  }
}

verify();
