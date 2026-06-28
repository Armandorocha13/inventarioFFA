import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import XLSX from 'xlsx';

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
  console.error("❌ ERRO: Variável DATABASE_URL não encontrada.");
  console.error("Por favor, execute o script passando a URL no comando:");
  console.error("  DATABASE_URL=\"sua_conexao_neon_ou_supabase\" node scripts/seed-pg.mjs");
  process.exit(1);
}

const PLANILHAS_DIR = path.join(process.cwd(), 'docs', 'planilhas');
const planilhaNome = 'consolidado estoque inventario.xlsx';
const planilhaPath = path.join(PLANILHAS_DIR, planilhaNome);

if (!fs.existsSync(planilhaPath)) {
  console.error(`❌ Planilha não encontrada: docs/planilhas/${planilhaNome}`);
  process.exit(1);
}

function parseNumero(val) {
  if (val === undefined || val === null) return 0;
  const clean = String(val).replace(/\s/g, '').replace(',', '.');
  const parsed = parseFloat(clean);
  return Number.isNaN(parsed) ? 0 : parsed;
}

const str = (v) => (v ? String(v).trim() : '');

export function obterContratoEOrigem(base, projeto) {
  const baseUpper = str(base).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const projUpper = str(projeto).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  let cidade = str(base);
  let contrato = 21;

  if (baseUpper === 'ESPIRITO SANTO') {
    cidade = 'ESPIRITO SANTO';
    contrato = projUpper.includes('SSO') ? 62 : 61;
  } else if (baseUpper === 'SAO PAULO') {
    cidade = 'SÃO PAULO';
    if (projUpper.includes('31') || projUpper.includes('SEGUNRANCA')) {
      contrato = 31;
    } else {
      contrato = 1;
    }
  } else if (['UBERLANDIA', 'VALADARES', 'BELO HORIZONTE', 'JUIZ DE FORA', 'VARGINHA'].includes(baseUpper)) {
    contrato = (projUpper.includes('SSO') || projUpper.includes('SEG')) ? 59 : 58;
  } else if (baseUpper === 'CURITIBA' || baseUpper === 'PARANA') {
    cidade = 'CURITIBA';
    contrato = projUpper.includes('SSO') ? 72 : 71;
  } else {
    if (projUpper.includes('SEG') || projUpper.includes('SSO') || projUpper.includes('REG SSO')) {
      contrato = 41;
    } else {
      contrato = 21;
    }
  }

  return { contrato, cidade };
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log("🚀 Iniciando seed do banco Postgres...");

    // Limpa tabelas antes de popular
    await client.query('DELETE FROM saldo_estoque');
    await client.query('DELETE FROM de_para_projeto');

    console.log('Lendo planilha de estoque...');
    const wb = XLSX.readFile(planilhaPath);
    const sheetName = wb.SheetNames.includes('CONSOLIDADO') ? 'CONSOLIDADO' : wb.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);

    const deParaProjetosUnicos = new Map();
    let saldoCount = 0;

    const insertSaldoSql = `
      INSERT INTO saldo_estoque (
        data, origem, contrato, grupo, codmat, descricao, unidade,
        saldo_estoque, saldo_disponivel, valor, total_real, classe_abc
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `;

    for (const r of rows) {
      const base = str(r['Base'] ?? r['Base '] ?? r['Cidade'] ?? r['BASE']);
      const projeto = str(r['Projeto']);
      const codmat = str(r['Código'] ?? r['Codigo']);
      
      if (!base || !projeto || !codmat) continue;

      const { contrato, cidade } = obterContratoEOrigem(base, projeto);

      const dataStr = str(r['Data']);
      const descricao = str(r['Descrição'] ?? r['Descricao']);
      const unidade = str(r['Unidade'] ?? r['Unid'] ?? r['Unidade ']);
      const saldo = parseNumero(r['Saldo']);
      const valor = parseNumero(r['Valor Unitario'] ?? r['Valor Unitário'] ?? r['Valor']);
      const totalReal = parseNumero(r['Total Real'] ?? (saldo * valor));
      const classeAbc = str(r['Classe ABC'] ?? r['ClasseABC'] ?? r['Classe']);

      await client.query(insertSaldoSql, [
        dataStr,
        cidade,
        contrato,
        projeto,
        codmat,
        descricao,
        unidade,
        saldo,
        saldo, // saldo_disponivel inicializa com saldo_estoque
        valor,
        totalReal,
        classeAbc
      ]);
      saldoCount++;

      const key = `${contrato}|${cidade}|${projeto}`;
      if (!deParaProjetosUnicos.has(key)) {
        deParaProjetosUnicos.set(key, { contrato, cidade, projeto });
      }
    }

    const insertProjetoSql = `
      INSERT INTO de_para_projeto (contrato, cidade, projeto)
      VALUES ($1, $2, $3)
    `;

    for (const p of deParaProjetosUnicos.values()) {
      await client.query(insertProjetoSql, [p.contrato, p.cidade, p.projeto]);
    }

    await client.query('COMMIT');
    console.log(`✓ saldo_estoque: ${saldoCount} linhas inseridas`);
    console.log(`✓ de_para_projeto: ${deParaProjetosUnicos.size} projetos inseridos`);
    console.log('✅ Seed de produção concluído com sucesso!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ ERRO ao executar seed no Postgres:", err);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

run();
