import type { NotificationType, Prisma, Role } from '@prisma/client';

type Db = Prisma.TransactionClient;

interface NotifyOptions {
  type?: NotificationType;
  orderId?: string | null;
  /** Rôles destinataires : tous les utilisateurs actifs concernés sont notifiés. */
  roles?: Role[];
  /** Destinataires directs (prioritaire sur `roles`). */
  userIds?: string[];
}

/** Crée des notifications internes pour les rôles/utilisateurs ciblés. */
export async function notify(
  tx: Db,
  title: string,
  message: string,
  options: NotifyOptions = {},
): Promise<void> {
  let targets = options.userIds ?? [];

  if (!targets.length && options.roles?.length) {
    const users = await tx.user.findMany({
      where: { role: { in: options.roles }, isActive: true },
      select: { id: true },
    });
    targets = users.map((user) => user.id);
  }

  if (!targets.length) return;

  await tx.notification.createMany({
    data: targets.map((userId) => ({
      userId,
      title,
      message,
      type: options.type ?? 'SYSTEME',
      orderId: options.orderId ?? null,
    })),
  });
}
