import { z } from 'zod';
import { paginationSchema } from '../../utils/http.js';

export const idParamSchema = z.object({ id: z.uuid('Identifiant invalide') });

export const listCategoriesQuerySchema = paginationSchema.extend({
  parentId: z.uuid().nullable().optional(),
  includeInactive: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  tree: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export const categoryBodySchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis').max(120),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, 'Slug invalide (a-z, 0-9, -)')
    .max(140)
    .optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  parentId: z.uuid().optional().nullable(),
  isActive: z.boolean().default(true),
});

export type CategoryBody = z.infer<typeof categoryBodySchema>;
export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>;
