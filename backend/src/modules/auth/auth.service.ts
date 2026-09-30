import jwt, { type SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { Role, User } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { unauthorized, notFound, conflict } from '../../lib/errors.js';
import type { CreateUserInput, LoginInput, UpdateUserInput } from './auth.schemas.js';

const SALT_ROUNDS = 10;

const publicUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type PublicUser = Pick<User, keyof typeof publicUserSelect>;

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

export async function login(input: LoginInput): Promise<{ token: string; user: PublicUser }> {
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });

  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw unauthorized('Email ou mot de passe incorrect');
  }
  if (!user.isActive) {
    throw unauthorized('Compte désactivé');
  }

  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] },
  );

  return { token, user: stripUser(user) };
}

export async function getProfile(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
  if (!user) throw notFound('Utilisateur');
  return user;
}

// ---------------------------------------------------------------------------
// Utilisateurs (administration)
// ---------------------------------------------------------------------------

export async function listUsers(params: {
  page: number;
  pageSize: number;
  search?: string;
  role?: Role;
  isActive?: boolean;
}) {
  const where = {
    ...(params.role ? { role: params.role } : {}),
    ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
    ...(params.search
      ? {
          OR: [
            { email: { contains: params.search, mode: 'insensitive' as const } },
            { firstName: { contains: params.search, mode: 'insensitive' as const } },
            { lastName: { contains: params.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: publicUserSelect,
      orderBy: [{ createdAt: 'desc' }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
  ]);

  return { total, items };
}

export async function createUser(input: CreateUserInput): Promise<PublicUser> {
  const email = input.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw conflict('Un utilisateur existe déjà avec cet email');

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(input.password, SALT_ROUNDS),
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone ?? null,
      role: input.role,
      isActive: input.isActive,
    },
    select: publicUserSelect,
  });

  if (user.role === 'LIVREUR') {
    await prisma.deliveryPerson.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        name: `${user.firstName} ${user.lastName}`,
        phone: user.phone ?? '',
      },
    });
  }

  return user;
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<PublicUser> {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw notFound('Utilisateur');

  if (input.email && input.email.toLowerCase() !== existing.email) {
    const clash = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (clash) throw conflict('Un utilisateur existe déjà avec cet email');
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(input.email ? { email: input.email.toLowerCase() } : {}),
      ...(input.firstName ? { firstName: input.firstName } : {}),
      ...(input.lastName ? { lastName: input.lastName } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.role ? { role: input.role } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.password ? { passwordHash: await bcrypt.hash(input.password, SALT_ROUNDS) } : {}),
    },
    select: publicUserSelect,
  });

  if (user.role === 'LIVREUR') {
    await prisma.deliveryPerson.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        name: `${user.firstName} ${user.lastName}`,
        phone: user.phone ?? '',
      },
    });
  }

  return user;
}

/** Désactivation (jamais de suppression physique : l'historique référence l'utilisateur). */
export async function deactivateUser(id: string, currentUserId: string): Promise<PublicUser> {
  if (id === currentUserId) {
    throw conflict('Vous ne pouvez pas désactiver votre propre compte');
  }
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw notFound('Utilisateur');
  return prisma.user.update({
    where: { id },
    data: { isActive: false },
    select: publicUserSelect,
  });
}

function stripUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}
