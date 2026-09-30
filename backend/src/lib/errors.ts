export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, message: string, code = 'ERROR', details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message = 'Requête invalide', details?: unknown) =>
  new AppError(400, message, 'BAD_REQUEST', details);

export const unauthorized = (message = 'Authentification requise') =>
  new AppError(401, message, 'UNAUTHORIZED');

export const forbidden = (message = 'Accès refusé') =>
  new AppError(403, message, 'FORBIDDEN');

export const notFound = (resource = 'Ressource') =>
  new AppError(404, `${resource} introuvable`, 'NOT_FOUND');

export const conflict = (message = 'Conflit', details?: unknown) =>
  new AppError(409, message, 'CONFLICT', details);

export const unprocessable = (message: string, details?: unknown) =>
  new AppError(422, message, 'UNPROCESSABLE', details);
