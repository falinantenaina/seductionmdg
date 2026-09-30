import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { ListAuditQuery } from './audit.schemas.js';

export async function listAudit(query: ListAuditQuery) {
  const where: Prisma.AuditLogWhereInput = {
    ...(query.action ? { action: query.action } : {}),
    ...(query.entity ? { entity: query.entity } : {}),
    ...(query.userId ? { userId: query.userId } : {}),
    ...(query.from || query.to
      ? {
          createdAt: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lte: query.to } : {}),
          },
        }
      : {}),
    ...(query.search
      ? {
          OR: [
            { action: { contains: query.search, mode: 'insensitive' } },
            { entity: { contains: query.search, mode: 'insensitive' } },
            { entityId: { contains: query.search, mode: 'insensitive' } },
            { user: { email: { contains: query.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return { total, items };
}

/** Actions et entités déjà journalisées : sert aux filtres de l'interface. */
export async function facets() {
  const [actions, entities] = await Promise.all([
    prisma.auditLog.groupBy({ by: ['action'], _count: { _all: true }, orderBy: { action: 'asc' } }),
    prisma.auditLog.groupBy({ by: ['entity'], _count: { _all: true }, orderBy: { entity: 'asc' } }),
  ]);

  return {
    actions: actions.map((row) => ({ value: row.action, count: row._count._all })),
    entities: entities.map((row) => ({ value: row.entity, count: row._count._all })),
  };
}
