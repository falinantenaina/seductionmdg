import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { asyncHandler } from '../utils/asyncHandler.js';

interface TokenPayload {
  sub: string;
  email: string;
  role: Role;
}

/** Vérifie le JWT et charge l'utilisateur (hébergé dans req.user). */
export const authenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw unauthorized('Token manquant');
  }

  let payload: TokenPayload;
  try {
    payload = jwt.verify(header.slice(7), env.JWT_SECRET) as TokenPayload;
  } catch {
    throw unauthorized('Token invalide ou expiré');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, role: true, firstName: true, lastName: true, isActive: true },
  });

  if (!user) throw unauthorized('Utilisateur introuvable');
  if (!user.isActive) throw forbidden('Compte désactivé');

  req.user = {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
  };
  next();
});

/**
 * Contrôle d'accès par rôle (RBAC).
 * L'ADMIN dispose d'un accès complet et est toujours autorisé.
 */
export function authorize(...roles: Role[]): (req: Request, _res: Response, next: NextFunction) => void {
  return (req, _res, next) => {
    if (!req.user) {
      next(unauthorized());
      return;
    }
    if (req.user.role === 'ADMIN' || roles.includes(req.user.role)) {
      next();
      return;
    }
    const label = roles.length ? `les rôles : ${roles.join(', ')}` : 'l\'administration';
    next(forbidden(`Accès réservé à ${label}`));
  };
}

export function requireUser(req: Request) {
  if (!req.user) throw unauthorized();
  return req.user;
}
