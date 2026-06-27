/**
 * Ponto de entrada do banco. Hoje aponta para Postgres; na Fase B
 * passará a selecionar entre `pg` (prod) e `sqlite` (dev) via env.
 */
export { db } from './pg';
export type { Db, DbClient, DbTransaction, QueryParam, QueryResult } from './adapter';
