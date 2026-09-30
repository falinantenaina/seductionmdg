import 'dotenv/config';

export const TEST_DB_NAME = 'seduction_test';

/** URL de la base dédiée aux tests : jamais la base de démonstration. */
function buildTestDatabaseUrl(): string {
  const base = process.env.DATABASE_URL ?? 'postgresql://postgres:root@127.0.0.1:5432/seduction';
  try {
    const url = new URL(base);
    url.pathname = `/${TEST_DB_NAME}`;
    return url.toString();
  } catch {
    return base;
  }
}

export const TEST_DATABASE_URL = buildTestDatabaseUrl();
