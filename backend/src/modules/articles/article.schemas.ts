import { z } from 'zod';
import { paginationSchema } from '../../utils/http.js';

export const idParamSchema = z.object({ id: z.uuid('Identifiant invalide') });

export const unitEnum = z.enum(['PIECE', 'KG', 'LITRE', 'METRE', 'CARTON', 'BOITE', 'PALET']);

export const listArticlesQuerySchema = paginationSchema.extend({
  categoryId: z.uuid().optional(),
  unit: unitEnum.optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  lowStock: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  inStock: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  sort: z.enum(['name', 'sku', 'price', 'stock']).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export const articleBodySchema = z.object({
  sku: z.string().trim().min(1, 'La référence est requise').max(60),
  name: z.string().trim().min(1, 'Le nom est requis').max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  categoryId: z.uuid().optional().nullable(),
  unit: unitEnum.default('PIECE'),
  price: z.number().min(0, 'Le prix ne peut pas être négatif').max(99999999),
  alertThreshold: z.number().int().min(0).default(0),
  imageUrl: z.string().trim().url('URL invalide').max(500).optional().nullable(),
  isActive: z.boolean().default(true),
  /** Stock initial : créé comme mouvement ENTREE pour rester tracé. */
  initialQuantity: z.number().int().min(0).default(0),
});

export const updateArticleBodySchema = articleBodySchema
  .omit({ initialQuantity: true })
  .partial();

export type ListArticlesQuery = z.infer<typeof listArticlesQuerySchema>;
export type ArticleBody = z.infer<typeof articleBodySchema>;
export type UpdateArticleBody = z.infer<typeof updateArticleBodySchema>;
