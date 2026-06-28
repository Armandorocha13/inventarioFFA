import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const { Pool } = pg;

// Tenta carregar DATABASE_URL de arquivos .env / .env.local
let dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  try {
    const envFile = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
    const match = envFile.match(/DATABASE_URL=["']?([^"'\n]+)["']?/);
    if (match) dbUrl = match[1];
  } catch (e) {
    try {
      const envFile = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
      const match = envFile.match(/DATABASE_URL=["']?([^"'\n]+)["']?/);
      if (match) dbUrl = match[1];
    } catch (e) {}
  }
}

if (!dbUrl) {
  console.error("❌ ERRO: Variável DATABASE_URL não encontrada no ambiente ou nos arquivos .env / .env.local.");
  console.error("Por favor, execute o script passando a URL no comando:");
  console.error("  DATABASE_URL=\"sua_conexao_neon\" node scripts/migrate-pg.mjs");
  process.exit(1);
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log("🚀 Iniciando migração no banco Postgres...");

    // 1. Criar tabelas auxiliares se não existirem
    console.log("  ↳ Garantindo que de_para_projeto existe...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS de_para_projeto (
        id        SERIAL PRIMARY KEY,
        contrato  INTEGER,
        cidade    VARCHAR(255),
        projeto   VARCHAR(255)
      );
    `);

    console.log("  ↳ Garantindo que de_para_itens existe...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS de_para_itens (
        id      SERIAL PRIMARY KEY,
        grupo   VARCHAR(255),
        codmat  VARCHAR(255),
        UNIQUE (grupo, codmat)
      );
    `);

    console.log("  ↳ Garantindo que progresso_contagem existe...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS progresso_contagem (
        id                  SERIAL PRIMARY KEY,
        cidade              VARCHAR(255),
        grupo               VARCHAR(255),
        codmat              VARCHAR(255),
        quantidade_contada  NUMERIC,
        atualizado_em       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (cidade, grupo, codmat)
      );
    `);

    console.log("  ↳ Garantindo que historico_contagem existe...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS historico_contagem (
        id              SERIAL PRIMARY KEY,
        codmat          VARCHAR(255),
        descricao       VARCHAR(255),
        valor_anterior  NUMERIC,
        valor_novo      NUMERIC,
        desvio          NUMERIC,
        observacao      TEXT,
        origem          VARCHAR(255),
        grupo           VARCHAR(255),
        timestamp       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Garantir/Adaptar a tabela saldo_estoque
    console.log("  ↳ Garantindo que saldo_estoque existe...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS saldo_estoque (
        id                  SERIAL PRIMARY KEY,
        data                VARCHAR(255),
        origem              VARCHAR(255),
        contrato            INTEGER,
        grupo               VARCHAR(255),
        codmat              VARCHAR(255),
        descricao           VARCHAR(255),
        unidade             VARCHAR(255),
        saldo_estoque       NUMERIC,
        saldo_disponivel    NUMERIC,
        valor               NUMERIC,
        total_real          NUMERIC,
        classe_abc          VARCHAR(255)
      );
    `);

    // 3. Modificar saldo_estoque se ela for herdada do esquema antigo
    console.log("  ↳ Adaptando colunas da tabela saldo_estoque...");
    
    // Obter colunas existentes
    const colsRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'saldo_estoque'
    `);
    const colunas = new Set(colsRes.rows.map(r => r.column_name));

    // Novas colunas a adicionar
    const colunasParaAdicionar = [
      { nome: 'data', tipo: 'VARCHAR(255)' },
      { nome: 'origem', tipo: 'VARCHAR(255)' },
      { nome: 'contrato', tipo: 'INTEGER' },
      { nome: 'unidade', tipo: 'VARCHAR(255)' },
      { nome: 'total_real', tipo: 'NUMERIC' },
      { nome: 'classe_abc', tipo: 'VARCHAR(255)' }
    ];

    for (const col of colunasParaAdicionar) {
      if (!colunas.has(col.nome)) {
        console.log(`    + Adicionando coluna '${col.nome}'...`);
        await client.query(`ALTER TABLE saldo_estoque ADD COLUMN ${col.nome} ${col.tipo}`);
      }
    }

    // Colunas antigas a remover
    const colunasParaRemover = [
      'tipo_saldo',
      'grupo_codigo',
      'descricao_auxiliar',
      'unid',
      'codcpl',
      'cod_cpl_auxiliar',
      'prog_rm',
      'prog_tm',
      'cod_grupo_material',
      'grupo_material'
    ];

    for (const col of colunasParaRemover) {
      if (colunas.has(col)) {
        console.log(`    - Removendo coluna antiga '${col}'...`);
        await client.query(`ALTER TABLE saldo_estoque DROP COLUMN IF EXISTS ${col}`);
      }
    }

    // 4. Criar índices se não existirem
    console.log("  ↳ Criando índices de desempenho...");
    await client.query(`CREATE INDEX IF NOT EXISTS idx_saldo_estoque_grupo_codmat ON saldo_estoque (grupo, codmat)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_saldo_estoque_contrato ON saldo_estoque (contrato)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_saldo_estoque_origem ON saldo_estoque (origem)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_historico_origem ON historico_contagem (origem)`);

    // 5. Recriar a view vw_estoque_contagem
    console.log("  ↳ Recriando a view vw_estoque_contagem...");
    await client.query(`DROP VIEW IF EXISTS vw_estoque_contagem`);
    await client.query(`
      CREATE VIEW vw_estoque_contagem AS
      SELECT
        se.id                               AS id,
        se.origem                           AS origem,
        se.contrato                         AS contrato,
        se.grupo                            AS grupo,
        se.codmat                           AS codmat,
        se.descricao                        AS descricao,
        se.unidade                          AS unidade,
        se.saldo_estoque                    AS "saldoAtual",
        se.valor                            AS "precoUnitario",
        se.classe_abc                       AS "classeABC",
        pc.quantidade_contada               AS "ultimaContagemFisica"
      FROM saldo_estoque se
      LEFT JOIN progresso_contagem pc
        ON pc.codmat = se.codmat AND pc.cidade = se.origem AND pc.grupo = se.grupo
    `);

    await client.query('COMMIT');
    console.log("✅ Migração de produção concluída com sucesso!");
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ ERRO ao executar migração no Postgres:", err);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

run();
