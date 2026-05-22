import XLSX from 'xlsx';
import pg from 'pg';
import path from 'path';
import { filtrarEProcessarDados, detectarColunasAtivas } from '../../js/auxiliaresImportacao.js';

const { Client } = pg;

// 1. Configurações
const EXCEL_FILE = 'Saldo Estoque.xlsx';
const TABLE_NAME = 'saldo_estoque';
const BATCH_SIZE = 500; // Tamanho ideal de lote para inserção eficiente no Postgres

// Mapeamento e normalização de cabeçalhos
const HEADER_MAPPING = {
  'Tipo Saldo': 'tipo_saldo',
  'Grupo': 'grupo',
  'Codmat': 'codmat',
  'Descrição': 'descricao',
  'Descrição Auxiliar': 'descricao_auxiliar',
  'Unid': 'unid',
  'Codcpl': 'codcpl',
  'Cód. Mat. Auxiliar': 'cod_mat_auxiliar',
  'Cód. Cpl. Auxiliar': 'cod_cpl_auxiliar',
  'Saldo em Estoque': 'saldo_estoque',
  'Prog. RM': 'prog_rm',
  'Prog. TM': 'prog_tm',
  'Saldo Disponível': 'saldo_disponivel',
  'Valor': 'valor',
  'Cod. Grupo Material': 'cod_grupo_material',
  'Grupo de Material': 'grupo_material'
};

const DB_COLUMNS = [
  'tipo_saldo',
  'grupo_codigo',
  'grupo',
  'codmat',
  'descricao',
  'descricao_auxiliar',
  'unid',
  'codcpl',
  'cod_mat_auxiliar',
  'cod_cpl_auxiliar',
  'saldo_estoque',
  'prog_rm',
  'prog_tm',
  'saldo_disponivel',
  'valor',
  'cod_grupo_material',
  'grupo_material'
];

const COLUMN_TYPES = {
  tipo_saldo: 'VARCHAR(100)',
  grupo: 'VARCHAR(255)',
  grupo_codigo: 'VARCHAR(50)',
  codmat: 'VARCHAR(100)',
  descricao: 'VARCHAR(255)',
  descricao_auxiliar: 'VARCHAR(255)',
  unid: 'VARCHAR(50)',
  codcpl: 'VARCHAR(100)',
  cod_mat_auxiliar: 'VARCHAR(100)',
  cod_cpl_auxiliar: 'VARCHAR(100)',
  saldo_estoque: 'NUMERIC(15, 4)',
  prog_rm: 'NUMERIC(15, 4)',
  prog_tm: 'NUMERIC(15, 4)',
  saldo_disponivel: 'NUMERIC(15, 4)',
  valor: 'NUMERIC(15, 4)',
  cod_grupo_material: 'VARCHAR(100)',
  grupo_material: 'VARCHAR(255)'
};

async function run() {
  const startTime = Date.now();
  console.log('🚀 Iniciando processo de importação para o Neon DB (Postgres)...');

  // --- FASE 1: Ler e processar o arquivo Excel ---
  const filePath = path.resolve(EXCEL_FILE);
  console.log(`📂 Lendo planilha: ${filePath}...`);
  
  let workbook;
  try {
    workbook = XLSX.readFile(filePath);
  } catch (err) {
    console.error('❌ Erro ao ler o arquivo Excel:', err.message);
    process.exit(1);
  }

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  console.log(`📊 Planilha selecionada: "${sheetName}"`);

  // Ler tudo como matriz de linhas/colunas
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  console.log(`🔢 Total de linhas brutas na planilha: ${rows.length}`);

  // Processar e filtrar os dados com a lógica unitária testada por TDD
  console.log('🧹 Executando limpeza, mapeamento e filtragem dos dados (TDD process)...');
  const filteredData = filtrarEProcessarDados(rows, HEADER_MAPPING, DB_COLUMNS);
  console.log(`🎯 Linhas que atendem ao filtro (Codmat iniciando com "1000"): ${filteredData.length}`);

  if (filteredData.length === 0) {
    console.log('⚠️ Nenhum registro correspondente ao filtro encontrado. Abortando.');
    process.exit(0);
  }

  // Detectar colunas ativas de forma dinâmica (normalização solicitada pelo usuário)
  console.log('🔍 Analisando colunas ativas e ignorando colunas completamente vazias...');
  const activeColumns = detectarColunasAtivas(filteredData, DB_COLUMNS);
  const ignoredColumns = DB_COLUMNS.filter(col => !activeColumns.includes(col));

  console.log(`✨ Colunas ativas identificadas (${activeColumns.length}): ${activeColumns.join(', ')}`);
  if (ignoredColumns.length > 0) {
    console.log(`🚫 Colunas completamente vazias ignoradas (${ignoredColumns.length}): ${ignoredColumns.join(', ')}`);
  } else {
    console.log('💚 Nenhuma coluna foi ignorada.');
  }

  // --- FASE 2: Conectar ao Neon DB e persistir os dados ---
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ Variável de ambiente DATABASE_URL não configurada no .env!');
    process.exit(1);
  }

  console.log('🔌 Conectando ao Neon Serverless Postgres...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false } // Requerido para conexões Neon seguras
  });

  try {
    await client.connect();
    console.log('✅ Conexão estabelecida com sucesso!');

    // Iniciar transação para criar a tabela de forma limpa
    await client.query('BEGIN');

    console.log(`🧹 Removendo tabela antiga "${TABLE_NAME}" se existir...`);
    await client.query(`DROP TABLE IF EXISTS ${TABLE_NAME} CASCADE;`);

    console.log(`🏗️ Criando tabela "${TABLE_NAME}" com a nova estrutura dinâmica...`);
    const columnDefinitions = ['id SERIAL PRIMARY KEY'];
    activeColumns.forEach(col => {
      const type = COLUMN_TYPES[col] || 'VARCHAR(255)';
      columnDefinitions.push(`${col} ${type}`);
    });

    const createTableQuery = `
      CREATE TABLE ${TABLE_NAME} (
        ${columnDefinitions.join(',\n        ')}
      );
    `;
    await client.query(createTableQuery);

    // Criar índice na coluna codmat para pesquisas super rápidas (se ativa)
    if (activeColumns.includes('codmat')) {
      console.log(`⚡ Criando índice de performance na coluna "codmat"...`);
      await client.query(`CREATE INDEX idx_${TABLE_NAME}_codmat ON ${TABLE_NAME}(codmat);`);
    }

    await client.query('COMMIT');
    console.log('✅ Estrutura de tabela e índices criados com sucesso!');

    // --- FASE 3: Inserção em Lote (Batch Insert) ---
    console.log(`📥 Iniciando inserção de ${filteredData.length} registros em lotes de ${BATCH_SIZE}...`);

    for (let i = 0; i < filteredData.length; i += BATCH_SIZE) {
      const batch = filteredData.slice(i, i + BATCH_SIZE);
      
      // Montar a query de inserção em lote parametrizada
      const valuePlaceholders = [];
      const values = [];
      let paramCount = 1;

      batch.forEach(row => {
        const rowPlaceholders = [];
        activeColumns.forEach(col => {
          rowPlaceholders.push(`$${paramCount++}`);
          values.push(row[col]);
        });
        valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
      });

      const insertQuery = `
        INSERT INTO ${TABLE_NAME} (${activeColumns.join(', ')}) 
        VALUES ${valuePlaceholders.join(', ')}
      `;

      await client.query('BEGIN');
      await client.query(insertQuery, values);
      await client.query('COMMIT');

      const progress = Math.min(i + BATCH_SIZE, filteredData.length);
      console.log(`⏳ Progresso: ${progress}/${filteredData.length} registros salvos...`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n🎉 CONCLUÍDO COM SUCESSO!`);
    console.log(`⏱️ Tempo total gasto: ${duration} segundos`);
    console.log(`📝 Total de registros importados no Neon DB: ${filteredData.length}`);

  } catch (err) {
    console.log('❌ Ocorreu um erro crítico durante o processo. Executando ROLLBACK...');
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    console.error('💥 Detalhes do erro:', err);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Conexão com o Neon finalizada.');
  }
}

run();
