import { z } from 'zod';
import type { Response } from 'express';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
});

export type Pagination = z.infer<typeof paginationSchema>;

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function paginationOffset(pagination: Pagination): { skip: number; take: number } {
  return { skip: (pagination.page - 1) * pagination.pageSize, take: pagination.pageSize };
}

export function pageMeta(total: number, pagination: Pagination): PageMeta {
  return {
    page: pagination.page,
    pageSize: pagination.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)),
  };
}

export function searchWhere(search: string | undefined, fields: string[]): Record<string, unknown>[] {
  if (!search) return [];
  return fields.map((field) => ({ [field]: { contains: search, mode: 'insensitive' as const } }));
}

export function sendData<T>(res: Response, data: T, meta?: PageMeta, status = 200): void {
  res.status(status).json(meta ? { success: true, data, meta } : { success: true, data });
}

export function created<T>(res: Response, data: T): void {
  sendData(res, data, undefined, 201);
}
