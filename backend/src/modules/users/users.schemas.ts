import { z } from 'zod';

export const roleEnum = z.enum([
  'ADMIN',
  'COMMERCIAL',
  'FACTURIER',
  'MAGASINIER',
  'DISPATCHER',
  'LIVREUR',
]);

export const idParamSchema = z.object({ id: z.uuid('Identifiant invalide') });

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  role: roleEnum.optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
