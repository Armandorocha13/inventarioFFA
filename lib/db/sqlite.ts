/**
 * Implementação SQLite do adapter (banco de desenvolvimento).
 *
 * Os services emitem SQL no dialeto Postgres (que produção usa nativamente).
 * Aqui traduzimos os poucos Postgres-ismos presentes no código para que o
 * MESMO SQL rode sobre SQLite:
 *   - placeholders `$N`  → parâmetros nomeados do better-sqlite3 ({ "1": v })
 *   - `ILIKE`            → `LIKE` (case-insensitive para ASCII no SQLite)
 *   - casts `::tipo`     → removidos
 *   - função `TRANSLATE` → registrada como função custom
 */
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import type { Db, DbTransaction, QueryParam, QueryResult } from './adapter';

const DB_PATH =
  process.env.SQLITE_PATH || path.join(process.cwd(), 'data', 'sgi-dev.sqlite');

function abrirConexao(): Database.Database {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const conn = new Database(DB_PATH);
  conn.pragma('journal_mode = WAL');
  conn.pragma('foreign_keys = ON');

  // TRANSLATE(str, from, to): substitui cada caractere de `from` pelo
  // correspondente em `to` (ou remove se `to` for mais curto).
  conn.function('TRANSLATE', (str: unknown, from: unknown, to: unknown) => {
    if (str == null) return null;
    const s = String(str);
    const f = String(from);
    const t = String(to ?? '');
    let out = '';
    for (const ch of s) {
      const i = f.indexOf(ch);
      out += i === -1 ? ch : t[i] ?? '';
    }
    return out;
  });

  return conn;
}

declare global {
  var _sqliteConn: Database.Database | undefined;
}

const conn = global._sqliteConn ?? abrirConexao();
if (process.env.NODE_ENV !== 'production') global._sqliteConn = conn;

/** Traduz o SQL no dialeto Postgres para SQLite. */
function traduzirSql(sql: string): string {
  return sql
    .replace(/\bILIKE\b/gi, 'LIKE')
    // remove casts ::tipo e ::tipo[]
    .replace(/::\s*[A-Za-z_]+(\s*\[\s*\])?/g, '');
}

/** Converte array posicional [a,b] em objeto nomeado { "1": a, "2": b }. */
function nomearParams(params: QueryParam[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  params.forEach((p, i) => {
    // booleanos não são suportados pelo better-sqlite3 → 0/1
    obj[String(i + 1)] = typeof p === 'boolean' ? (p ? 1 : 0) : (p as unknown);
  });
  return obj;
}

function exec<T>(sql: string, params: QueryParam[] = []): QueryResult<T> {
  const traduzido = traduzirSql(sql);
  const stmt = conn.prepare(traduzido);
  const bind = params.length ? nomearParams(params) : undefined;

  if (stmt.reader) {
    const rows = (bind ? stmt.all(bind) : stmt.all()) as T[];
    return { rows, rowCount: rows.length };
  }
  const info = bind ? stmt.run(bind) : stmt.run();
  return { rows: [], rowCount: info.changes };
}

function makeTransaction(): DbTransaction {
  conn.exec('BEGIN');
  let finalizado = false;
  return {
    async query<T>(sql: string, params: QueryParam[] = []): Promise<QueryResult<T>> {
      return exec<T>(sql, params);
    },
    async commit() {
      if (finalizado) return;
      finalizado = true;
      conn.exec('COMMIT');
    },
    async rollback() {
      if (finalizado) return;
      finalizado = true;
      conn.exec('ROLLBACK');
    },
    release() {
      // Conexão única reutilizável — nada a liberar.
    },
  };
}

export const db: Db = {
  dialect: 'sqlite',

  async query<T>(sql: string, params: QueryParam[] = []): Promise<QueryResult<T>> {
    return exec<T>(sql, params);
  },

  async begin(): Promise<DbTransaction> {
    return makeTransaction();
  },

  async transaction<T>(fn: (tx: DbTransaction) => Promise<T>): Promise<T> {
    const tx = await this.begin();
    try {
      const result = await fn(tx);
      await tx.commit();
      return result;
    } catch (err) {
      await tx.rollback();
      throw err;
    } finally {
      tx.release();
    }
  },
};

export { conn as sqliteConnection };
