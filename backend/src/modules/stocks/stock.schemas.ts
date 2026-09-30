import { z } from 'zod';
import { paginationSchema } from '../../utils/http.js';

export const listStocksQuerySchema = paginationSchema.extend({
  categoryId: z.uuid().optional(),
  lowStock: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  includeInactive: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export const listMovementsQuerySchema = paginationSchema.extend({
  articleId: z.uuid().optional(),
  orderId: z.uuid().optional(),
  type: z
    .enum(['ENTREE', 'SORTIE', 'AJUSTEMENT', 'RESERVATION', 'ANNULATION_RESERVATION', 'RETOUR'])
    .optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const entryStockSchema = z.object({
  articleId: z.uuid('Article invalide'),
  quantity: z.number().int().positive('La quantité doit être positive'),
  comment: z.string().trim().max(500).optional(),
});

export const adjustStockSchema = z.object({
  articleId: z.uuid('Article invalide'),
  newPhysical: z.number().int().min(0, 'Le stock physique ne peut pas être négatif'),
  comment: z.string().trim().max(500).optional(),
});

export type ListStocksQuery = z.infer<typeof listStocksQuerySchema>;
export type ListMovementsQuery = z.infer<typeof listMovementsQuerySchema>;
export type EntryStockInput = z.infer<typeof entryStockSchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
