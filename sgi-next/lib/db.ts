/**
 * db.ts — Pool de conexões PostgreSQL compartilhado (Neon Serverless DB)
 * ─────────────────────────────────────────────────────────────────────────────
 * Exporta um Pool singleton para ser reutilizado em todas as API Routes.
 * Em desenvolvimento com hot-reload, previne criação de múltiplos pools
 * usando o objeto global como cache.
 */
import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

let pool: Pool;

if (process.env.NODE_ENV === 'production') {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
} else {
  // Em dev, reutiliza o pool entre hot-reloads para não estourar conexões
  if (!global._pgPool) {
    global._pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
  }
  pool = global._pgPool;
}

export { pool };
