import { z } from 'zod';
import type { OrderStatus } from '@prisma/client';
import { paginationSchema } from '../../utils/http.js';

export const idParamSchema = z.object({ id: z.uuid('Identifiant invalide') });

/** Tous les statuts possibles d'une commande (vérification des filtres). */
const ORDER_STATUS_VALUES = [
  'BROUILLON',
  'COMMANDE',
  'EN_FACTURATION',
  'FACTUREE',
  'A_PREPARER',
  'SORTIE_MAGASIN',
  'EN_LIVRAISON',
  'LIVREE',
  'ANNULEE',
] as const;

export const orderItemInputSchema = z.object({
  articleId: z.uuid('Article invalide'),
  quantity: z.number().int().positive('Quantité invalide').max(1_000_000),
});

const orderFields = {
  customerId: z.uuid('Client invalide'),
  commercialId: z.uuid().optional(),
  items: z.array(orderItemInputSchema).min(1, 'Au moins un article').max(200),
  comments: z.string().trim().max(2000).optional().nullable(),
  deliveryAddress: z.string().trim().max(300).optional().nullable(),
  deliveryPlace: z.string().trim().max(300).optional().nullable(),
  recipientName: z.string().trim().max(160).optional().nullable(),
  recipientPhone: z.string().trim().max(40).optional().nullable(),
};

export const createOrderSchema = z.object({
  ...orderFields,
  /** BROUILLON = brouillon sans réservation ; sinon validation + réservation immédiate. */
  saveAsDraft: z.boolean().default(false),
});

export const updateOrderSchema = z.object({
  ...orderFields,
  customerId: orderFields.customerId.optional(),
  items: orderFields.items.optional(),
});

export const cancelOrderSchema = z.object({
  reason: z.string().trim().min(3, 'Merci de préciser le motif').max(500),
});

/** Mise à jour ciblée des informations de livraison / contact d'une commande. */
export const deliveryInfoSchema = z
  .object({
    deliveryAddress: z.string().trim().max(300).nullish(),
    deliveryPlace: z.string().trim().max(300).nullish(),
    recipientName: z.string().trim().max(160).nullish(),
    recipientPhone: z.string().trim().max(40).nullish(),
  })
  .refine(
    (value) =>
      value.deliveryAddress !== undefined ||
      value.deliveryPlace !== undefined ||
      value.recipientName !== undefined ||
      value.recipientPhone !== undefined,
    'Aucune information de livraison à modifier',
  );

export const listOrdersQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  /** Un statut, ou plusieurs séparés par des virgules (ex. `FACTUREE,A_PREPARER`). */
  status: z
    .string()
    .trim()
    .max(60)
    .optional()
    .transform((value) =>
      value
        ? value
            .split(',')
            .map((chunk) => chunk.trim())
            .filter(Boolean)
        : undefined,
    )
    .refine(
      (values) =>
        values === undefined ||
        values.every((value) => (ORDER_STATUS_VALUES as readonly string[]).includes(value)),
      'Statut de commande invalide',
    )
    .transform((values) => values as OrderStatus[] | undefined),
  commercialId: z.uuid().optional(),
  customerId: z.uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  /** Restreint aux commandes du commercial connecté */
  mine: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export type OrderItemInput = z.infer<typeof orderItemInputSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
export type DeliveryInfoInput = z.infer<typeof deliveryInfoSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
