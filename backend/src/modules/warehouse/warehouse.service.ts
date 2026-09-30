import type { Prisma, User } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { conflict, notFound, unprocessable } from '../../lib/errors.js';
import { recordAudit } from '../../utils/audit.js';
import { notify } from '../../utils/notify.js';
import { applyMovement, lockArticles } from '../stocks/stock.service.js';
import type { ExitOrderInput, ListExitsQuery } from './warehouse.schemas.js';

type Actor = Pick<User, 'id' | 'role'>;

/** Statuts ayant franchi la porte du magasin (historique des sorties). */
const EXITED_STATUSES = ['SORTIE_MAGASIN', 'EN_LIVRAISON', 'LIVREE'] as const;

/**
 * Statuts autorisant la sortie : facturée, payée **ou non** — le paiement
 * peut intervenir à la livraison (encaissement par le facturier ensuite).
 */
const EXITABLE_STATUSES = ['FACTUREE', 'A_PREPARER'] as const;

const orderSummaryInclude = {
  customer: { select: { id: true, name: true, phone: true, city: true } },
  commercial: { select: { id: true, firstName: true, lastName: true } },
  items: { select: { quantity: true } },
  invoice: { select: { invoiceNumber: true, status: true, paidAt: true } },
  delivery: { select: { deliveryNumber: true, status: true } },
} satisfies Prisma.OrderInclude;

export type OrderSummary = Prisma.OrderGetPayload<{ include: typeof orderSummaryInclude }>;

/**
 * Sortie physique du magasin : consomme la réservation et décrémente le stock
 * physique. Un seul mouvement `SORTIE` par ligne (delta physique ET réservé).
 */
export async function exitOrder(orderId: string, input: ExitOrderInput, user: Actor) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        customer: { select: { id: true, name: true } },
        invoice: { select: { invoiceNumber: true, status: true } },
      },
    });

    if (!order) throw notFound('Commande');

    if (order.status === 'SORTIE_MAGASIN') throw conflict('Cette commande est déjà sortie du magasin');
    if (order.status === 'EN_LIVRAISON' || order.status === 'LIVREE') {
      throw conflict('Cette commande est déjà en cours de livraison');
    }
    if (order.status === 'ANNULEE') throw conflict('Une commande annulée ne peut pas sortir du magasin');
    if (!(EXITABLE_STATUSES as readonly string[]).includes(order.status)) {
      throw unprocessable(
        `La commande doit être facturée avant la sortie (statut actuel : ${order.status})`,
        { status: order.status, expected: [...EXITABLE_STATUSES] },
      );
    }
    if (!order.invoice) {
      throw unprocessable('La commande doit être facturée avant la sortie', { expected: [...EXITABLE_STATUSES] });
    }
    if (!order.items.length) throw unprocessable('La commande ne contient aucun article');

    const locked = await lockArticles(
      tx,
      order.items.map((item) => item.articleId),
    );

    // 1. Contrôle de cohérence sur toutes les lignes avant toute écriture
    for (const item of order.items) {
      const article = locked.get(item.articleId);
      if (!article) throw notFound('Article');
      if (article.stockReserved < item.quantity) {
        throw unprocessable(
          `Réservation incohérente pour ${article.sku} : réservé ${article.stockReserved}, à sortir ${item.quantity}`,
          { articleId: article.id, reserved: article.stockReserved, requested: item.quantity },
        );
      }
    }

    // 2. Sortie physique (stock physique ET réservé diminuent d'un même mouvement)
    const comment = input.comment ?? null;
    for (const item of order.items) {
      const article = locked.get(item.articleId);
      if (!article) throw notFound('Article');
      await applyMovement(tx, article, {
        type: 'SORTIE',
        quantity: item.quantity,
        orderId: order.id,
        userId: user.id,
        comment: comment ?? `Sortie magasin — commande ${order.orderNumber}`,
      });
    }

    const releasedAt = input.exitDate ?? new Date();
    const updated = await tx.order.update({
      where: { id: order.id },
      data: { status: 'SORTIE_MAGASIN', releasedAt },
      include: orderSummaryInclude,
    });

    const paid = order.invoice.status === 'PAYEE';
    await notify(
      tx,
      'Sortie magasin validée',
      `La commande ${order.orderNumber} (${order.customer.name}) est sortie du magasin${
        paid ? '' : ' — paiement à la livraison à encaisser'
      } et attend l'affectation d'un livreur.`,
      { type: 'SORTIE_MAGASIN', orderId: order.id, roles: ['DISPATCHER'] },
    );

    await recordAudit(tx, {
      userId: user.id,
      action: 'ORDER_EXIT',
      entity: 'Order',
      entityId: order.id,
      oldValue: { status: order.status },
      newValue: { status: 'SORTIE_MAGASIN', items: order.items.length, paid, comment },
    });

    return updated;
  });
}

/** Historique des sorties de magasin (paginé, filtrable par période). */
export async function listExits(query: ListExitsQuery) {
  const where: Prisma.OrderWhereInput = {
    status: { in: [...EXITED_STATUSES] },
    ...(query.from || query.to
      ? {
          releasedAt: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lte: query.to } : {}),
          },
        }
      : {}),
    ...(query.search
      ? {
          OR: [
            { orderNumber: { contains: query.search, mode: 'insensitive' } },
            { customer: { name: { contains: query.search, mode: 'insensitive' } } },
            { customer: { phone: { contains: query.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: orderSummaryInclude,
      orderBy: { releasedAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return { total, items };
}
