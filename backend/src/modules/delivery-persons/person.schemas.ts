import { z } from 'zod';
import { paginationSchema } from '../../utils/http.js';

export const idParamSchema = z.object({ id: z.uuid('Identifiant invalide') });

export const createPersonSchema = z.object({
  name: z.string().trim().min(2, 'Nom trop court').max(80),
  phone: z.string().trim().min(5, 'Téléphone invalide').max(30),
  vehicle: z.string().trim().max(60).nullish(),
  /** Compte utilisateur de rôle LIVREUR rattaché au profil (optionnel). */
  userId: z.uuid('Utilisateur invalide').nullish(),
});

export const updatePersonSchema = createPersonSchema
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Aucune modification fournie',
  });

export const listPeopleQuerySchema = paginationSchema.extend({
  isActive: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export type CreatePersonInput = z.infer<typeof createPersonSchema>;
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;
export type ListPeopleQuery = z.infer<typeof listPeopleQuerySchema>;
