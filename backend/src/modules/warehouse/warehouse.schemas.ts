import { z } from 'zod';
import { paginationSchema } from '../../utils/http.js';

export const idParamSchema = z.object({ id: z.uuid('Identifiant invalide') });

export const exitOrderSchema = z.object({
  /** Observation du magasin (colis, contrôle, réserves...). */
  comment: z.string().trim().max(500).nullish(),
  /** Date de sortie effective (défaut : maintenant). */
  exitDate: z.coerce.date().nullish(),
});

export const listExitsQuerySchema = paginationSchema.extend({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type ExitOrderInput = z.infer<typeof exitOrderSchema>;
export type ListExitsQuery = z.infer<typeof listExitsQuerySchema>;
