import { z } from 'zod';
import { paginationSchema } from '../../utils/http.js';

export const idParamSchema = z.object({ id: z.uuid('Identifiant invalide') });

export const DELIVERY_STATUSES = ['A_LIVRER', 'AFFECTEE', 'EN_COURS', 'LIVREE', 'ECHEC', 'ANNULEE'] as const;

export const createDeliverySchema = z.object({
  orderId: z.uuid('Commande invalide'),
  scheduledAt: z.coerce.date().nullish(),
  instructions: z.string().trim().max(500).nullish(),
});

export const assignDeliverySchema = z.object({
  deliveryPersonId: z.uuid('Livreur invalide'),
  scheduledAt: z.coerce.date().nullish(),
});

export const completeDeliveryItemSchema = z.object({
  deliveryItemId: z.uuid('Ligne invalide'),
  quantityDelivered: z.coerce.number().int().min(0, 'Quantité livrée négative'),
});

export const completeDeliverySchema = z.object({
  deliveredAt: z.coerce.date().nullish(),
  observations: z.string().trim().max(500).nullish(),
  items: z.array(completeDeliveryItemSchema).max(200).optional(),
});

export const failDeliverySchema = z.object({
  reason: z.string().trim().min(3, 'Merci de préciser le motif').max(500),
});

export const listDeliveriesQuerySchema = paginationSchema.extend({
  status: z.enum(DELIVERY_STATUSES).optional(),
  deliveryPersonId: z.uuid().optional(),
  orderId: z.uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  /** Restreint aux livraisons du livreur connecté */
  mine: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export type CreateDeliveryInput = z.infer<typeof createDeliverySchema>;
export type AssignDeliveryInput = z.infer<typeof assignDeliverySchema>;
export type CompleteDeliveryInput = z.infer<typeof completeDeliverySchema>;
export type FailDeliveryInput = z.infer<typeof failDeliverySchema>;
export type ListDeliveriesQuery = z.infer<typeof listDeliveriesQuerySchema>;
