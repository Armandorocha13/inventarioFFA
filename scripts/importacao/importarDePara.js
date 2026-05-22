import XLSX from 'xlsx';
import pg from 'pg';
import path from 'path';
import { processarDePara, detectarColunasAtivas } from '../../js/auxiliaresImportacao.js';

const { Client } = pg;

// 1. Configurações
const EXCEL_FILE = 'deParaProjeto.xlsx';
const TABLE_NAME = 'de_para_projeto';
const BATCH_SIZE = 500;

// Mapeamento de cabeçalhos
const HEADER_MAPPING = {
  'CONTRATO': 'contrato',
  'CIDADE': 'cidade',
  'PROJETO': 'projeto'
};

const DB_COLUMNS = Object.values(HEADER_MAPPING);

const COLUMN_TYPES = {
  contrato: 'INTEGER',
  cidade: 'VARCHAR(100)',
  projeto: 'VARCHAR(255)'
};

async function run() {
  const startTime = Date.now();
  console.log('🚀 Iniciando processo de importação do De-Para para o Neon DB (Postgres)...');

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

  // Processar e mapear os dados com a lógica unitária testada por TDD
  console.log('🧹 Executando mapeamento, limpeza e processamento dos dados...');
  const processedData = processarDePara(rows, HEADER_MAPPING, DB_COLUMNS);
  console.log(`🎯 Registros válidos processados: ${processedData.length}`);

  if (processedData.length === 0) {
    console.log('⚠️ Nenhum registro válido encontrado. Abortando.');
    process.exit(0);
  }

  // Detectar colunas ativas de forma dinâmica (normalização solicitada)
  console.log('🔍 Analisando colunas ativas e ignorando colunas completamente vazias...');
  const activeColumns = detectarColunasAtivas(processedData, DB_COLUMNS);
  const ignoredColumns = DB_COLUMNS.filter(col => !activeColumns.includes(col));

  console.log(`✨ Colunas ativas identificadas (${activeColumns.length}): ${activeColumns.join(', ')}`);
  if (ignoredColumns.length > 0) {
    console.log(`🚫 Colunas completamente vazias ignoradas (${ignoredColumns.length}): ${ignoredColumns.join(', ')}`);
  } else {
    console.log('💚 Nenhuma coluna foi ignorada (todas possuem dados).');
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
    ssl: { rejectUnauthorized: false }
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

    // Criar índice na coluna contrato e projeto para pesquisas super rápidas
    if (activeColumns.includes('contrato')) {
      console.log(`⚡ Criando índice de performance na coluna "contrato"...`);
      await client.query(`CREATE INDEX idx_${TABLE_NAME}_contrato ON ${TABLE_NAME}(contrato);`);
    }
    if (activeColumns.includes('projeto')) {
      console.log(`⚡ Criando índice de performance na coluna "projeto"...`);
      await client.query(`CREATE INDEX idx_${TABLE_NAME}_projeto ON ${TABLE_NAME}(projeto);`);
    }

    await client.query('COMMIT');
    console.log('✅ Estrutura de tabela e índices criados com sucesso!');

    // --- FASE 3: Inserção em Lote (Batch Insert) ---
    console.log(`📥 Iniciando inserção de ${processedData.length} registros em lotes de ${BATCH_SIZE}...`);

    for (let i = 0; i < processedData.length; i += BATCH_SIZE) {
      const batch = processedData.slice(i, i + BATCH_SIZE);
      
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

      const progress = Math.min(i + BATCH_SIZE, processedData.length);
      console.log(`⏳ Progresso: ${progress}/${processedData.length} registros salvos...`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n🎉 CONCLUÍDO COM SUCESSO!`);
    console.log(`⏱️ Tempo total gasto: ${duration} segundos`);
    console.log(`📝 Total de registros importados no Neon DB: ${processedData.length}`);

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
