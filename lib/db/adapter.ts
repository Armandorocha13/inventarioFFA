/**
 * Contrato do banco usado por toda a camada de services.
 *
 * Implementações concretas (lib/db/pg.ts, futuro lib/db/sqlite.ts) devem
 * traduzir os parâmetros $1..$N do dialeto Postgres caso precisem — para
 * manter as queries dos services homogêneas.
 */

export type QueryParam = string | number | boolean | null | Date | number[] | string[];

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

export interface DbClient {
  query<T = Record<string, unknown>>(sql: string, params?: QueryParam[]): Promise<QueryResult<T>>;
}

export interface DbTransaction extends DbClient {
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): void;
}

export interface Db extends DbClient {
  begin(): Promise<DbTransaction>;
  /**
   * Executa `fn` dentro de uma transação. Faz COMMIT em sucesso e ROLLBACK
   * em qualquer erro, sempre liberando o client no final.
   */
  transaction<T>(fn: (tx: DbTransaction) => Promise<T>): Promise<T>;
}
