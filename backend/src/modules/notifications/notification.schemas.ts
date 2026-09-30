import { z } from 'zod';
import { paginationSchema } from '../../utils/http.js';

export const idParamSchema = z.object({ id: z.uuid('Identifiant invalide') });

export const NOTIFICATION_TYPES = [
  'NOUVELLE_COMMANDE',
  'FACTURE_VALIDE',
  'SORTIE_MAGASIN',
  'LIVRAISON_AFFECTEE',
  'STATUT_COMMANDE',
  'STOCK_FAIBLE',
  'SYSTEME',
] as const;

export const listNotificationsQuerySchema = paginationSchema.extend({
  type: z.enum(NOTIFICATION_TYPES).optional(),
  unreadOnly: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
