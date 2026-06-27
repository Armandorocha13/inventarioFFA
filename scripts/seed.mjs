// Popula o banco SQLite a partir das planilhas em docs/planilhas/:
//   - de_para_projeto  ← deParaProjeto.xlsx  (CONTRATO, CIDADE, PROJETO)
//   - de_para_itens    ← listagem.xlsx       (Grupo, Codmat)
//   - saldo_estoque    ← Saldo Estoque.xlsx  (aba SINAPSE)
import path from 'node:path';
import fs from 'node:fs';
import XLSX from 'xlsx';
import { abrirBanco, PLANILHAS_DIR } from './_db.mjs';

function parseNumero(val) {
  if (val === undefined || val === null) return 0;
  const clean = String(val).replace(/\s/g, '').replace(',', '.');
  const parsed = parseFloat(clean);
  return Number.isNaN(parsed) ? 0 : parsed;
}

const str = (v) => (v ? String(v).trim() : '');
const strOrNull = (v) => (v ? String(v).trim() : null);

function seedProjetos(db) {
  const wb = XLSX.readFile(path.join(PLANILHAS_DIR, 'deParaProjeto.xlsx'));
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  const stmt = db.prepare(
    'INSERT INTO de_para_projeto (contrato, cidade, projeto) VALUES (?, ?, ?)'
  );
  let n = 0;
  db.transaction(() => {
    for (const r of rows) {
      const contrato = parseInt(String(r.CONTRATO ?? '').trim(), 10);
      const cidade = str(r.CIDADE);
      if (!Number.isFinite(contrato) || !cidade) continue;
      stmt.run(contrato, cidade, str(r.PROJETO));
      n++;
    }
  })();
  console.log(`✓ de_para_projeto: ${n} linhas`);
}

function seedItens(db) {
  const wb = XLSX.readFile(path.join(PLANILHAS_DIR, 'listagem.xlsx'));
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO de_para_itens (grupo, codmat) VALUES (?, ?)'
  );
  let n = 0;
  db.transaction(() => {
    for (const r of rows) {
      const grupo = str(r.Grupo);
      const codmat = str(r.Codmat);
      if (!grupo || !codmat) continue;
      const info = stmt.run(grupo, codmat);
      if (info.changes) n++;
    }
  })();
  console.log(`✓ de_para_itens: ${n} linhas únicas`);
}

function seedSaldo(db) {
  const wb = XLSX.readFile(path.join(PLANILHAS_DIR, 'Saldo Estoque.xlsx'));
  const sheetName = wb.SheetNames.includes('SINAPSE') ? 'SINAPSE' : wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });

  const stmt = db.prepare(`
    INSERT INTO saldo_estoque (
      tipo_saldo, grupo_codigo, grupo, codmat, descricao, descricao_auxiliar,
      unid, codcpl, cod_cpl_auxiliar, saldo_estoque, prog_rm, prog_tm,
      saldo_disponivel, valor, cod_grupo_material, grupo_material
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  let n = 0;
  db.transaction(() => {
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const tipoSaldo = str(row[0]);
      if (tipoSaldo === 'Tipo Saldo' || tipoSaldo === '') continue;

      const grupo = str(row[1]);
      const codmat = str(row[2]);
      if (!grupo || !codmat) continue;

      const match = grupo.match(/^(\d+)\//);
      const grupoCodigo = match ? match[1] : '';

      stmt.run(
        tipoSaldo, grupoCodigo, grupo, codmat, str(row[3]), strOrNull(row[4]),
        str(row[5]), str(row[6]), strOrNull(row[8]), parseNumero(row[9]),
        parseNumero(row[10]), parseNumero(row[11]), parseNumero(row[12]),
        parseNumero(row[13]), strOrNull(row[14]), strOrNull(row[15])
      );
      n++;
    }
  })();
  console.log(`✓ saldo_estoque: ${n} linhas`);
}

export function seed() {
  for (const f of ['deParaProjeto.xlsx', 'listagem.xlsx', 'Saldo Estoque.xlsx']) {
    if (!fs.existsSync(path.join(PLANILHAS_DIR, f))) {
      throw new Error(`Planilha não encontrada: docs/planilhas/${f}`);
    }
  }

  const db = abrirBanco();
  // Limpa antes de popular (idempotente).
  db.exec(`
    DELETE FROM saldo_estoque;
    DELETE FROM de_para_itens;
    DELETE FROM de_para_projeto;
    DELETE FROM sqlite_sequence
      WHERE name IN ('saldo_estoque','de_para_itens','de_para_projeto');
  `);

  seedProjetos(db);
  seedItens(db);
  seedSaldo(db);
  db.close();
  console.log('Seed concluído.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed();
}
