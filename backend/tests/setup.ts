import { TEST_DATABASE_URL } from './env.js';

// Doit précéder l'import de src/app.ts (config/env.ts lit ces variables).
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = TEST_DATABASE_URL;
