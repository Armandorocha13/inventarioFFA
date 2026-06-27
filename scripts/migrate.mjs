// Aplica as migrations SQL de lib/db/migrations em ordem alfabética.
// Registra as aplicadas em `_migrations` para ser idempotente.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirBanco, DB_PATH, MIGRATIONS_DIR } from './_db.mjs';

export function migrate() {
  const db = abrirBanco();

  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      nome TEXT PRIMARY KEY,
      aplicada_em TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const aplicadas = new Set(
    db.prepare('SELECT nome FROM _migrations').all().map((r) => r.nome)
  );

  const arquivos = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let n = 0;
  const inserir = db.prepare('INSERT INTO _migrations (nome) VALUES (?)');
  for (const arquivo of arquivos) {
    if (aplicadas.has(arquivo)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, arquivo), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      inserir.run(arquivo);
    })();
    console.log(`✓ migration aplicada: ${arquivo}`);
    n++;
  }

  if (n === 0) console.log('Nenhuma migration pendente.');
  db.close();
  console.log(`Banco: ${DB_PATH}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  migrate();
}

