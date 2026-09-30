import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import { TEST_DB_NAME, TEST_DATABASE_URL } from './env.js';

const root = path.join(__dirname, '..');

async function main(): Promise<void> {
  const serverUrl = new URL(TEST_DATABASE_URL);
  serverUrl.pathname = '/postgres';

  const admin = new Client({ connectionString: serverUrl.toString() });
  await admin.connect();
  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [TEST_DB_NAME]);
  if (!exists.rowCount) {
    await admin.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
  }
  await admin.end();

  const db = new Client({ connectionString: TEST_DATABASE_URL });
  await db.connect();
  await db.query('DROP SCHEMA public CASCADE');
  await db.query('CREATE SCHEMA public');
  await db.query('GRANT ALL ON SCHEMA public TO public');

  const migrationsDir = path.join(root, 'prisma', 'migrations');
  const folders = readdirSync(migrationsDir)
    .filter((name) => !name.endsWith('.toml'))
    .sort();
  for (const folder of folders) {
    const sql = readFileSync(path.join(migrationsDir, folder, 'migration.sql'), 'utf8');
    await db.query(sql);
  }
  await db.end();

  execFileSync(process.execPath, ['--import', 'tsx', path.join(root, 'prisma', 'seed.ts')], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL, NODE_ENV: 'test' },
    stdio: 'inherit',
  });

  process.stdout.write(
    `Base de test prête : ${TEST_DB_NAME} (${folders.length} migration(s) appliquée(s))\n`,
  );
}

main().catch((error) => {
  console.error('Échec de la préparation de la base de test :', error);
  process.exit(1);
});
