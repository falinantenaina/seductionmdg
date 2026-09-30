import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../lib/errors.js';

interface Schemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

function parse(schema: ZodType | undefined, value: unknown): unknown {
  if (!schema) return undefined;
  const result = schema.safeParse(value ?? {});
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    throw new AppError(400, 'Données invalides', 'VALIDATION_ERROR', details);
  }
  return result.data;
}

/**
 * Valide body / query / params avec Zod.
 * Les valeurs validées sont stockées dans `req.validated`
 * (Express 5 rend `req.query` non assignable).
 */
export function validate(schemas: Schemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.validated = {
        body: parse(schemas.body, req.body),
        query: parse(schemas.query, req.query),
        params: parse(schemas.params, req.params),
      };
      if (schemas.body) req.body = req.validated.body;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function validatedBody<T>(req: Request): T {
  return (req.validated?.body ?? {}) as T;
}

export function validatedQuery<T>(req: Request): T {
  return (req.validated?.query ?? {}) as T;
}

export function validatedParams<T>(req: Request): T {
  return (req.validated?.params ?? {}) as T;
}
