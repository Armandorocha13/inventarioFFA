/**
 * Ponto de entrada do banco. Seleciona a implementação ativa:
 *   - DB_DRIVER=sqlite | pg  força explicitamente
 *   - sem DB_DRIVER: usa Postgres se DATABASE_URL existir, senão SQLite
 *
 * A escolha é lazy via require para que `better-sqlite3` (módulo nativo)
 * só seja carregado quando o driver SQLite for realmente usado.
 */
import type { Db } from './adapter';

function resolverDriver(): 'pg' | 'sqlite' {
  const explicito = process.env.DB_DRIVER?.toLowerCase();
  if (explicito === 'sqlite' || explicito === 'pg') return explicito;
  return process.env.DATABASE_URL ? 'pg' : 'sqlite';
}

function carregar(): Db {
  if (resolverDriver() === 'sqlite') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('./sqlite') as { db: Db }).db;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('./pg') as { db: Db }).db;
}

export const db: Db = carregar();
export type { Db, DbClient, DbTransaction, QueryParam, QueryResult, Dialect } from './adapter';
