/**
 * Implementação Postgres do adapter de banco (Neon Serverless).
 * Reaproveita o pool entre hot-reloads em dev para não estourar conexões.
 */
import { Pool, type PoolClient } from 'pg';
import type { Db, DbTransaction, QueryParam, QueryResult } from './adapter';

declare global {
  var _pgPool: Pool | undefined;
}

function getPool(): Pool {
  if (process.env.NODE_ENV === 'production') {
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
  }
  if (!global._pgPool) {
    global._pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
  }
  return global._pgPool;
}

const pool = getPool();

function wrapTransaction(client: PoolClient): DbTransaction {
  let released = false;
  return {
    async query<T>(sql: string, params: QueryParam[] = []): Promise<QueryResult<T>> {
      const r = await client.query(sql, params);
      return { rows: r.rows as T[], rowCount: r.rowCount ?? 0 };
    },
    async commit() {
      await client.query('COMMIT');
    },
    async rollback() {
      await client.query('ROLLBACK');
    },
    release() {
      if (released) return;
      released = true;
      client.release();
    },
  };
}

export const db: Db = {
  dialect: 'pg',

  async query<T>(sql: string, params: QueryParam[] = []): Promise<QueryResult<T>> {
    const r = await pool.query(sql, params);
    return { rows: r.rows as T[], rowCount: r.rowCount ?? 0 };
  },

  async begin(): Promise<DbTransaction> {
    const client = await pool.connect();
    await client.query('BEGIN');
    return wrapTransaction(client);
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

/**
 * Pool exportado apenas para compatibilidade temporária com `lib/db.ts`.
 * Novos consumidores devem usar `db` acima.
 */
export { pool };
