import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';
import { isProd } from '../config/env.js';

interface ApiErrorPayload {
  success: false;
  message: string;
  code: string;
  details?: unknown;
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(404, `Route ${req.method} ${req.path} introuvable`, 'ROUTE_NOT_FOUND'));
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response<ApiErrorPayload>,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: 'Données invalides',
      code: 'VALIDATION_ERROR',
      details: err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = mapPrismaError(err);
    if (mapped) {
      res.status(mapped.status).json({
        success: false,
        message: mapped.message,
        code: mapped.code,
      });
      return;
    }
  }

  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      success: false,
      message: 'JSON malformé',
      code: 'INVALID_JSON',
    });
    return;
  }

  // Erreurs du middleware body-parser (JSON trop volumineux, etc.)
  const httpError = err as { status?: unknown; statusCode?: unknown };
  const status = typeof httpError.status === 'number' ? httpError.status : null;
  const altStatus = typeof httpError.statusCode === 'number' ? httpError.statusCode : null;
  const httpStatus = status ?? altStatus;
  if (httpStatus !== null && httpStatus >= 400 && httpStatus < 500) {
    res.status(httpStatus).json({
      success: false,
      message: httpStatus === 413 ? 'Corps de requête trop volumineux' : 'Requête invalide',
      code: httpStatus === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
    });
    return;
  }

  console.error('Erreur non gérée :', err);
  res.status(500).json({
    success: false,
    message: isProd ? 'Erreur interne du serveur' : String((err as Error)?.message ?? err),
    code: 'INTERNAL_ERROR',
  });
}

function mapPrismaError(
  err: Prisma.PrismaClientKnownRequestError,
): { status: number; message: string; code: string } | null {
  switch (err.code) {
    case 'P2002': {
      const target = (err.meta as { target?: string[] } | undefined)?.target;
      const field = Array.isArray(target) ? target.join(', ') : 'champ unique';
      return { status: 409, message: `Une valeur en double existe pour : ${field}`, code: 'UNIQUE_VIOLATION' };
    }
    case 'P2025':
      return { status: 404, message: 'Ressource introuvable', code: 'NOT_FOUND' };
    case 'P2003':
      return { status: 409, message: 'Opération impossible : des données liées existent', code: 'FK_VIOLATION' };
    case 'P2014':
      return { status: 409, message: 'Opération impossible : relation requise manquante', code: 'REQUIRED_RELATION' };
    case 'P2004':
      return { status: 400, message: 'Contrainte de base de données violée', code: 'CONSTRAINT_FAILED' };
    case 'P2021':
      return { status: 404, message: 'Table introuvable', code: 'NOT_FOUND' };
    case 'P2022':
      return { status: 500, message: 'Colonne introuvable dans la base', code: 'SCHEMA_MISMATCH' };
    default:
      return null;
  }
}
