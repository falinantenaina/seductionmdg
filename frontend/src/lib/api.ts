import axios, { AxiosError } from 'axios';
import type { ApiErrorBody } from '@/types';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Array<{ path: string; message: string }>;

  constructor(
    status: number,
    message: string,
    code = 'UNKNOWN',
    details: Array<{ path: string; message: string }> = [],
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static from(error: unknown): ApiError {
    if (error instanceof ApiError) return error;

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<ApiErrorBody>;
      const body = axiosError.response?.data;
      const status = axiosError.response?.status ?? 0;

      if (body && typeof body === 'object' && 'message' in body) {
        return new ApiError(status, body.message, body.code, body.details ?? []);
      }
      if (status === 0) {
        return new ApiError(0, 'Serveur injoignable, vérifiez votre connexion', 'NETWORK_ERROR');
      }
      return new ApiError(status, 'Une erreur est survenue', 'HTTP_ERROR');
    }

    return new ApiError(0, error instanceof Error ? error.message : 'Erreur inconnue', 'UNKNOWN');
  }

  /** Message affichable (premier détail de validation si présent). */
  get displayMessage(): string {
    return this.details[0]?.message ?? this.message;
  }
}

type TokenProvider = () => string | null;
type UnauthorizedHandler = () => void;

let tokenProvider: TokenProvider = () => null;
let unauthorizedHandler: UnauthorizedHandler = () => {};

/** Branché par le store d'authentification (évite les imports circulaires). */
export function setTokenProvider(provider: TokenProvider): void {
  tokenProvider = provider;
}

export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  unauthorizedHandler = handler;
}

export const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = tokenProvider();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const apiError = ApiError.from(error);
    if (apiError.status === 401 && apiError.code !== 'VALIDATION_ERROR') {
      unauthorizedHandler();
    }
    return Promise.reject(apiError);
  },
);

export function getErrorMessage(error: unknown): string {
  return ApiError.from(error).displayMessage;
}
