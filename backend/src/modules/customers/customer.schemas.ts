import { z } from 'zod';
import { paginationSchema } from '../../utils/http.js';

export const idParamSchema = z.object({ id: z.uuid('Identifiant invalide') });

export const listCustomersQuerySchema = paginationSchema.extend({
  isActive: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export const customerBodySchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis').max(160),
  contactName: z.string().trim().max(120).optional().nullable(),
  email: z.email('Email invalide').optional().nullable().or(z.literal('').transform(() => null)),
  phone: z.string().trim().max(40).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  deliveryPlace: z.string().trim().max(300).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  isActive: z.boolean().default(true),
});

export type CustomerBody = z.infer<typeof customerBodySchema>;
export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;
