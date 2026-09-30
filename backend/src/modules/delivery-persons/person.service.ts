import type { Prisma, User } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { conflict, notFound, unprocessable } from '../../lib/errors.js';
import { recordAudit } from '../../utils/audit.js';
import type { CreatePersonInput, ListPeopleQuery, UpdatePersonInput } from './person.schemas.js';

type Actor = Pick<User, 'id' | 'role'>;

/** Vérifie que le compte rattaché existe, est un livreur et n'est pas déjà pris. */
async function assertLivreAccount(userId: string | null | undefined, currentId?: string): Promise<void> {
  if (userId === undefined || userId === null) return;

  const account = await prisma.user.findUnique({ where: { id: userId } });
  if (!account) throw notFound('Utilisateur');
  if (account.role !== 'LIVREUR') {
    throw unprocessable('Le compte rattaché doit appartenir à un utilisateur de rôle Livreur', {
      role: account.role,
    });
  }
  const link = await prisma.deliveryPerson.findUnique({ where: { userId } });
  if (link && link.id !== currentId) {
    throw conflict(`Ce compte est déjà rattaché au profil ${link.name}`);
  }
}

export async function listPeople(query: ListPeopleQuery) {
  const where: Prisma.DeliveryPersonWhereInput = {
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { phone: { contains: query.search, mode: 'insensitive' } },
            { vehicle: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.deliveryPerson.count({ where }),
    prisma.deliveryPerson.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, isActive: true } },
        _count: { select: { deliveries: true } },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return { total, items };
}

export async function createPerson(input: CreatePersonInput, user: Actor) {
  await assertLivreAccount(input.userId);

  try {
    const person = await prisma.deliveryPerson.create({
      data: {
        name: input.name,
        phone: input.phone,
        vehicle: input.vehicle ?? null,
        userId: input.userId ?? null,
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, isActive: true } },
        _count: { select: { deliveries: true } },
      },
    });

    await recordAudit(prisma, {
      userId: user.id,
      action: 'DELIVERY_PERSON_CREATE',
      entity: 'DeliveryPerson',
      entityId: person.id,
      newValue: { name: person.name, phone: person.phone, userId: person.userId },
    });

    return person;
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2002') {
      throw conflict('Ce compte utilisateur est déjà rattaché à un autre profil livreur');
    }
    throw error;
  }
}

export async function updatePerson(id: string, input: UpdatePersonInput, user: Actor) {
  const existing = await prisma.deliveryPerson.findUnique({ where: { id } });
  if (!existing) throw notFound('Livreur');

  if ('userId' in input) {
    await assertLivreAccount(input.userId, existing.id);
  }

  const person = await prisma.deliveryPerson.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.vehicle !== undefined ? { vehicle: input.vehicle ?? null } : {}),
      ...(input.userId !== undefined ? { userId: input.userId ?? null } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true, isActive: true } },
      _count: { select: { deliveries: true } },
    },
  });

  await recordAudit(prisma, {
    userId: user.id,
    action: 'DELIVERY_PERSON_UPDATE',
    entity: 'DeliveryPerson',
    entityId: person.id,
    oldValue: { name: existing.name, phone: existing.phone, isActive: existing.isActive, userId: existing.userId },
    newValue: {
      name: person.name,
      phone: person.phone,
      isActive: person.isActive,
      userId: person.userId,
    },
  });

  return person;
}
