import type { Notification, Prisma, User } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { notFound } from '../../lib/errors.js';
import type { ListNotificationsQuery } from './notification.schemas.js';

type Actor = Pick<User, 'id' | 'role'>;

function scope(userId: string): Prisma.NotificationWhereInput {
  return { userId };
}

export async function listNotifications(query: ListNotificationsQuery, user: Actor) {
  const where: Prisma.NotificationWhereInput = {
    ...scope(user.id),
    ...(query.type ? { type: query.type } : {}),
    ...(query.unreadOnly ? { isRead: false } : {}),
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: 'insensitive' } },
            { message: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        isRead: true,
        orderId: true,
        createdAt: true,
        order: { select: { id: true, orderNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return { total, items };
}

export async function unreadCount(user: Actor): Promise<{ unread: number }> {
  const unread = await prisma.notification.count({ where: { userId: user.id, isRead: false } });
  return { unread };
}

export async function markRead(id: string, user: Actor): Promise<Notification> {
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification || notification.userId !== user.id) throw notFound('Notification');

  return prisma.notification.update({ where: { id }, data: { isRead: true } });
}

export async function markAllRead(user: Actor): Promise<{ updated: number }> {
  const result = await prisma.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data: { isRead: true },
  });
  return { updated: result.count };
}
