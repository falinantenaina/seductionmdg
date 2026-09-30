import type { Role } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
}

export interface ValidatedInput {
  body?: unknown;
  query?: unknown;
  params?: unknown;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      validated?: ValidatedInput;
    }
  }
}

export {};
