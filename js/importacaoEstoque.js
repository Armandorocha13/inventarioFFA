import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs/promises';
import sqlite3 from 'sqlite3';

export const DEFAULT_EXCEL_FILE = 'Saldo Estoque.xlsx';
export const DEFAULT_TABLE_NAME = 'saldo_estoque';
export const DEFAULT_DB_PATH = path.join('db', 'inventario.db');
export const DEFAULT_BATCH_SIZE = 500;
export const DEFAULT_SHEET_NAME = 'SINAPSE';
export const DEFAULT_CODMAT_PREFIX = '1000';

export const HEADER_MAPPING = {
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
  'Grupo de Material': 'grupo_material',
};

export const DB_COLUMNS = Object.values(HEADER_MAPPING);
export const NUMERIC_COLUMNS = [
  'saldo_estoque',
  'prog_rm',
  'prog_tm',
  'saldo_disponivel',
  'valor',
];

export function parseNumeric(val) {
  if (val === undefined || val === null || String(val).trim() === '') return 0;
  const num = Number(String(val).replace(',', '.'));
  return Number.isNaN(num) ? 0 : num;
}

export function buildHeaderIndices(rawHeaders = []) {
  const headerIndices = {};
  rawHeaders.forEach((header, index) => {
    if (header && HEADER_MAPPING[header]) {
      headerIndices[HEADER_MAPPING[header]] = index;
    }
  });
  return headerIndices;
}

export function mapRows(rows, { codmatPrefix = DEFAULT_CODMAT_PREFIX } = {}) {
  if (!Array.isArray(rows) || rows.length < 2) {
    throw new Error('A planilha não possui dados suficientes (mínimo cabeçalho e dados).');
  }

  const rawHeaders = rows[1] || [];
  const headerIndices = buildHeaderIndices(rawHeaders);

  if (headerIndices.codmat === undefined) {
    throw new Error('Coluna "Codmat" não encontrada nos cabeçalhos.');
  }

  const filteredData = [];
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rawCodmat = row[headerIndices.codmat];
    const codmatStr = rawCodmat !== undefined && rawCodmat !== null ? String(rawCodmat).trim() : '';

    if (!codmatStr.startsWith(codmatPrefix)) continue;

    const mappedRow = {};
    DB_COLUMNS.forEach(col => {
      const index = headerIndices[col];
      let val = index !== undefined ? row[index] : null;

      if (NUMERIC_COLUMNS.includes(col)) {
        val = parseNumeric(val);
      } else if (val !== null && val !== undefined) {
        val = String(val).trim();
      } else {
        val = null;
      }

      mappedRow[col] = val;
    });

    filteredData.push(mappedRow);
  }

  return { filteredData, rawHeaders, totalRows: rows.length };
}

export function readExcelRows(filePath, preferredSheet = DEFAULT_SHEET_NAME) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames.includes(preferredSheet)
    ? preferredSheet
    : workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error('Nenhuma planilha encontrada no arquivo Excel.');
  }

  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  return { sheetName, rows };
}

function runAsync(dbOrStmt, sql, params = []) {
  return new Promise((resolve, reject) => {
    dbOrStmt.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function execAsync(db, sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, err => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function closeAsync(db) {
  return new Promise((resolve, reject) => {
    db.close(err => {
      if (err) return reject(err);
      resolve();
    });
  });
}

export function openDatabase(dbPath) {
  return new sqlite3.Database(dbPath);
}

export async function createSchema(db, tableName) {
  const schemaSql = `
    DROP TABLE IF EXISTS ${tableName};
    CREATE TABLE ${tableName} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo_saldo TEXT,
      grupo TEXT,
      codmat TEXT,
      descricao TEXT,
      descricao_auxiliar TEXT,
      unid TEXT,
      codcpl TEXT,
      cod_mat_auxiliar TEXT,
      cod_cpl_auxiliar TEXT,
      saldo_estoque REAL,
      prog_rm REAL,
      prog_tm REAL,
      saldo_disponivel REAL,
      valor REAL,
      cod_grupo_material TEXT,
      grupo_material TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_${tableName}_codmat ON ${tableName}(codmat);
  `;

  await execAsync(db, schemaSql);
}

export async function insertRows(db, tableName, rows, batchSize = DEFAULT_BATCH_SIZE) {
  if (!rows.length) return 0;

  const columns = DB_COLUMNS;
  const placeholders = columns.map(() => '?').join(', ');
  const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await runAsync(db, 'BEGIN');
    try {
      for (const row of batch) {
        const values = columns.map(col => row[col]);
        await runAsync(db, sql, values);
        inserted += 1;
      }
      await runAsync(db, 'COMMIT');
    } catch (err) {
      await runAsync(db, 'ROLLBACK');
      throw err;
    }
  }

  return inserted;
}

export async function importarEstoque({
  excelPath = DEFAULT_EXCEL_FILE,
  dbPath = DEFAULT_DB_PATH,
  tableName = DEFAULT_TABLE_NAME,
  batchSize = DEFAULT_BATCH_SIZE,
  codmatPrefix = DEFAULT_CODMAT_PREFIX,
  sheetName = DEFAULT_SHEET_NAME,
} = {}) {
  const startTime = Date.now();
  const { sheetName: usedSheet, rows } = readExcelRows(excelPath, sheetName);
  const { filteredData, totalRows } = mapRows(rows, { codmatPrefix });

  if (filteredData.length === 0) {
    return {
      sheetName: usedSheet,
      totalRows,
      filteredRows: 0,
      insertedRows: 0,
      dbPath,
      tableName,
      durationMs: Date.now() - startTime,
    };
  }

  if (dbPath !== ':memory:') {
    await fs.mkdir(path.dirname(dbPath), { recursive: true });
  }

  const db = openDatabase(dbPath);
  try {
    await createSchema(db, tableName);
    const insertedRows = await insertRows(db, tableName, filteredData, batchSize);
    return {
      sheetName: usedSheet,
      totalRows,
      filteredRows: filteredData.length,
      insertedRows,
      dbPath,
      tableName,
      durationMs: Date.now() - startTime,
    };
  } finally {
    await closeAsync(db);
  }
}
