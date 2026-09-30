import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email('Email invalide').max(160),
  password: z.string().min(1, 'Mot de passe requis').max(200),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const createUserSchema = z.object({
  email: z.email('Email invalide').max(160),
  password: z
    .string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
    .max(200),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(40).optional().nullable(),
  role: z.enum(['ADMIN', 'COMMERCIAL', 'FACTURIER', 'MAGASINIER', 'DISPATCHER', 'LIVREUR']),
  isActive: z.boolean().default(true),
});

export const updateUserSchema = createUserSchema.partial().omit({ password: true }).extend({
  password: z.string().min(8).max(200).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
