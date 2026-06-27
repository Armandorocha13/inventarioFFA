// Helper compartilhado pelos scripts de banco (migrate/seed/reset).
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

export const DB_PATH =
  process.env.SQLITE_PATH || path.join(process.cwd(), 'data', 'sgi-dev.sqlite');

export const MIGRATIONS_DIR = path.join(process.cwd(), 'lib', 'db', 'migrations');
export const PLANILHAS_DIR = path.join(process.cwd(), 'docs', 'planilhas');

export function abrirBanco() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}
