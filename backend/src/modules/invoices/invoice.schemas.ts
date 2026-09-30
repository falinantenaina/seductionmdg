import { z } from 'zod';
import { paginationSchema } from '../../utils/http.js';

export const idParamSchema = z.object({ id: z.uuid('Identifiant invalide') });

export const createInvoiceSchema = z.object({
  orderId: z.uuid('Commande invalide'),
  dueDate: z.coerce.date().nullish(),
  notes: z.string().trim().max(500).nullish(),
  /** BROUILLON = facture préparée mais non émise (commande « en facturation »). */
  saveAsDraft: z.boolean().default(false),
  /**
   * Informations de livraison / contact saisies (ou corrigées) par le facturier
   * au moment de la facturation : reprises sur la commande, la facture PDF
   * et la fiche de livraison. Un champ omis reste inchangé.
   */
  deliveryAddress: z.string().trim().max(300).nullish(),
  deliveryPlace: z.string().trim().max(300).nullish(),
  recipientName: z.string().trim().max(160).nullish(),
  recipientPhone: z.string().trim().max(40).nullish(),
});

export const cancelInvoiceSchema = z.object({
  reason: z.string().trim().min(3, 'Merci de préciser le motif').max(500),
});

export const listInvoicesQuerySchema = paginationSchema.extend({
  status: z.enum(['BROUILLON', 'EMISE', 'PAYEE', 'ANNULEE']).optional(),
  customerId: z.uuid().optional(),
  orderId: z.uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type CancelInvoiceInput = z.infer<typeof cancelInvoiceSchema>;
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;
