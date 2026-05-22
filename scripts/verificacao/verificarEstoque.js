import pg from 'pg';
const { Client } = pg;

const TABLE_NAME = 'saldo_estoque';

async function verify() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL não encontrada no .env');
    process.exit(1);
  }

  console.log('🔌 Conectando ao Neon DB para verificação...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Conectado.');

    // 1. Auditar as colunas da tabela no banco de dados para confirmar a normalização dinâmica
    console.log('\n🔍 Auditando as colunas da tabela no Neon...');
    const columnsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = $1 
      ORDER BY ordinal_position
    `, [TABLE_NAME]);

    const schemaColumns = columnsRes.rows.map(r => r.column_name);
    console.log(`✨ Estrutura da tabela "${TABLE_NAME}" no banco (${schemaColumns.length} colunas encontradas):`);
    console.table(columnsRes.rows);

    // Verificar se as colunas vazias foram de fato excluídas
    const ignoredColumns = ['descricao_auxiliar', 'cod_mat_auxiliar'];
    const hasIgnored = ignoredColumns.some(col => schemaColumns.includes(col));
    if (!hasIgnored) {
      console.log('💚 Sucesso! As colunas completamente vazias (descricao_auxiliar, cod_mat_auxiliar) foram devidamente ignoradas e não existem na tabela.');
    } else {
      console.error('❌ Falha! Encontramos colunas indesejadas que deveriam ter sido ignoradas:', ignoredColumns.filter(col => schemaColumns.includes(col)));
    }

    // 2. Verificar total de registros lidos
    console.log('\n📊 Verificando contagem de dados...');
    const countRes = await client.query(`SELECT COUNT(*) FROM ${TABLE_NAME}`);
    const totalRows = countRes.rows[0].count;
    console.log(`📊 Total de registros salvos na tabela "${TABLE_NAME}": ${totalRows}`);

    // 3. Verificar se todos os itens começam de fato com "1000"
    const invalidCountRes = await client.query(`
      SELECT COUNT(*) FROM ${TABLE_NAME} 
      WHERE codmat NOT LIKE '1000%'
    `);
    const invalidRows = invalidCountRes.rows[0].count;
    console.log(`🔍 Registros com "codmat" que NÃO começam com "1000": ${invalidRows}`);

    if (Number(invalidRows) === 0) {
      console.log('💚 Sucesso! Todos os registros têm "codmat" iniciado por "1000".');
    } else {
      console.error('❌ Erro! Existem registros inválidos na tabela.');
    }

    // 4. Exibir amostra dos 3 primeiros registros importados
    console.log('\n👀 Amostra dos 3 primeiros registros (somente colunas ativas):');
    
    // Seleciona colunas úteis para o console.table
    const activeSampleCols = ['id', 'tipo_saldo', 'grupo_codigo', 'grupo', 'codmat', 'descricao', 'saldo_estoque', 'valor'].filter(col => schemaColumns.includes(col));
    const sampleRes = await client.query(`
      SELECT ${activeSampleCols.join(', ')} 
      FROM ${TABLE_NAME} 
      ORDER BY id ASC 
      LIMIT 3
    `);
    console.table(sampleRes.rows);

    // 5. Testar a performance da coluna indexada "codmat"
    const sampleCodmat = sampleRes.rows[0]?.codmat;
    if (sampleCodmat) {
      console.log(`\n⚡ Testando query indexada para o codmat: "${sampleCodmat}"`);
      const searchStart = Date.now();
      const searchRes = await client.query(`
        SELECT id, descricao, saldo_estoque 
        FROM ${TABLE_NAME} 
        WHERE codmat = $1
      `, [sampleCodmat]);
      const searchDuration = Date.now() - searchStart;
      console.log(`✅ Busca retornou ${searchRes.rows.length} resultados em ${searchDuration}ms.`);
    }

  } catch (err) {
    console.error('💥 Erro ao executar verificação:', err);
  } finally {
    await client.end();
    console.log('🔌 Conexão finalizada.');
  }
}

verify();
