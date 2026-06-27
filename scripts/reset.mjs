// Recria o banco SQLite do zero: apaga o arquivo, migra e popula.
import fs from 'node:fs';
import { DB_PATH } from './_db.mjs';
import { migrate } from './migrate.mjs';
import { seed } from './seed.mjs';

for (const f of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) {
  if (fs.existsSync(f)) fs.rmSync(f);
}
console.log('Banco anterior removido.');

migrate();
seed();
console.log('Reset completo.');
