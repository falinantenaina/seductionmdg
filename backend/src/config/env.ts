import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

// .env résolu par rapport au projet (indépendant du cwd : requis sous Passenger).
dotenv.config({ path: path.resolve(__dirname, '../../.env') });


const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL est requis'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET doit contenir au moins 32 caractères'),
  JWT_EXPIRES_IN: z.string().default('12h'),
  PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Variables d'environnement invalides :\n${issues}`);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
