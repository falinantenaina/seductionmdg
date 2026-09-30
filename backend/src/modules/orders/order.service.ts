import type { Order, OrderStatus, Prisma, User } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { badRequest, conflict, notFound, unprocessable } from '../../lib/errors.js';
import { nextNumber } from '../../utils/sequence.js';
import { recordAudit } from '../../utils/audit.js';
import { notify } from '../../utils/notify.js';
import { applyMovement, lockArticles, type LockedArticle } from '../stocks/stock.service.js';
import type {
  CancelOrderInput,
  CreateOrderInput,
  DeliveryInfoInput,
  ListOrdersQuery,
  OrderItemInput,
  UpdateOrderInput,
} from './order.schemas.js';

type Db = Prisma.TransactionClient;
type Actor = Pick<User, 'id' | 'role'>;

const RESERVABLE_STATUSES: OrderStatus[] = ['COMMANDE', 'EN_FACTURATION', 'FACTUREE', 'A_PREPARER'];
/** Statuts pour lesquels la réservation a déjà été consommée par une sortie physique. */
const RELEASED_STATUSES: OrderStatus[] = ['SORTIE_MAGASIN', 'EN_LIVRAISON', 'LIVREE'];

const orderInclude = {
  customer: { select: { id: true, name: true, phone: true, address: true, deliveryPlace: true, city: true } },
  commercial: { select: { id: true, firstName: true, lastName: true, email: true } },
  items: {
    include: { article: { select: { id: true, sku: true, name: true, unit: true, price: true } } },
  },
  invoice: { select: { id: true, invoiceNumber: true, status: true, issueDate: true } },
  delivery: {
    select: {
      id: true,
      deliveryNumber: true,
      status: true,
      scheduledAt: true,
      deliveredAt: true,
      deliveryPerson: { select: { name: true, phone: true } },
    },
  },
} satisfies Prisma.OrderInclude;

export type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Fusionne les lignes identiques (même article) pour éviter les doublons de réservation. */
function mergeItems(items: OrderItemInput[]): OrderItemInput[] {
  const byArticle = new Map<string, number>();
  for (const item of items) {
    byArticle.set(item.articleId, (byArticle.get(item.articleId) ?? 0) + item.quantity);
  }
  return [...byArticle.entries()].map(([articleId, quantity]) => ({ articleId, quantity }));
}

async function loadPricedItems(tx: Db, items: OrderItemInput[]) {
  const articleIds = items.map((item) => item.articleId);
  const articles = await tx.article.findMany({
    where: { id: { in: articleIds } },
    select: { id: true, sku: true, name: true, price: true, unit: true, isActive: true },
  });
  const byId = new Map(articles.map((article) => [article.id, article]));

  return items.map((item) => {
    const article = byId.get(item.articleId);
    if (!article) throw notFound(`Article ${item.articleId} introuvable`);
    if (!article.isActive) throw unprocessable(`L'article ${article.sku} est inactif`);
    const unitPrice = Number(article.price);
    return {
      articleId: article.id,
      designation: `${article.sku} — ${article.name}`,
      quantity: item.quantity,
      unitPrice,
      lineTotal: round2(unitPrice * item.quantity),
    };
  });
}

/**
 * Réserve les quantités : verrouille les articles (FOR UPDATE, ordre trié),
 * vérifie le stock disponible puis incrémente le stock réservé.
 * À appeler dans une transaction.
 */
async function reserveStock(
  tx: Db,
  orderId: string,
  items: OrderItemInput[],
  userId: string,
): Promise<void> {
  const merged = mergeItems(items);
  const locked = await lockArticles(tx, merged.map((item) => item.articleId));

  // 1. Validation de la disponibilité sur TOUTES les lignes avant toute écriture
  for (const item of merged) {
    const article = locked.get(item.articleId);
    if (!article) throw notFound('Article introuvable');
    if (!article.isActive) throw unprocessable(`L'article ${article.sku} est inactif`);

    const available = article.stockPhysical - article.stockReserved;
    if (available < item.quantity) {
      throw unprocessable(
        `Stock disponible insuffisant pour ${article.sku} — disponible : ${available}, demandé : ${item.quantity}`,
        { articleId: article.id, available, requested: item.quantity },
      );
    }
  }

  // 2. Écriture de la réservation (uniquement si tout est disponible)
  for (const item of merged) {
    const article = locked.get(item.articleId) as LockedArticle;
    await applyMovement(tx, article, {
      type: 'RESERVATION',
      quantity: item.quantity,
      orderId,
      userId,
      comment: 'Réservation à la validation de la commande',
    });
  }
}

/** Libère la réservation (annulation avant sortie magasin). */
async function releaseStock(tx: Db, order: OrderWithRelations, userId: string): Promise<void> {
  const items = order.items.map((item) => ({ articleId: item.articleId, quantity: item.quantity }));
  const merged = mergeItems(items);
  const locked = await lockArticles(tx, merged.map((item) => item.articleId));

  for (const item of merged) {
    const article = locked.get(item.articleId);
    if (!article) throw notFound('Article introuvable');
    if (article.stockReserved < item.quantity) {
      throw unprocessable(
        `Réservation incohérente pour ${article.sku} : réservé ${article.stockReserved}, à libérer ${item.quantity}`,
      );
    }
    await applyMovement(tx, article, {
      type: 'ANNULATION_RESERVATION',
      quantity: item.quantity,
      orderId: order.id,
      userId,
      comment: 'Annulation de commande',
    });
  }
}

// ---------------------------------------------------------------------------
// Création
// ---------------------------------------------------------------------------

export async function createOrder(input: CreateOrderInput, user: Actor): Promise<OrderWithRelations> {
  const commercialId = input.commercialId ?? user.id;

  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({ where: { id: input.customerId } });
    if (!customer || !customer.isActive) throw notFound('Client');

    if (commercialId !== user.id && user.role !== 'ADMIN') {
      throw badRequest('Impossible de créer une commande au nom d\'un autre commercial');
    }
    const commercial = await tx.user.findUnique({ where: { id: commercialId } });
    if (!commercial || commercial.role !== 'COMMERCIAL') {
      throw badRequest('Le commercial référent est invalide');
    }

    const merged = mergeItems(input.items);
    const priced = await loadPricedItems(tx, merged);
    const subtotal = round2(priced.reduce((sum, item) => sum + item.lineTotal, 0));

    const orderNumber = await nextNumber(tx, 'order', 'CMD');
    const asDraft = input.saveAsDraft;

    const order = await tx.order.create({
      data: {
        orderNumber,
        customerId: customer.id,
        commercialId: commercial.id,
        status: asDraft ? 'BROUILLON' : 'COMMANDE',
        subtotal,
        total: subtotal,
        comments: input.comments ?? null,
        deliveryAddress: input.deliveryAddress ?? customer.address ?? null,
        deliveryPlace: input.deliveryPlace ?? customer.deliveryPlace ?? null,
        recipientName: input.recipientName ?? customer.contactName ?? null,
        recipientPhone: input.recipientPhone ?? customer.phone ?? null,
        reservedAt: asDraft ? null : new Date(),
        items: {
          create: priced.map((item) => ({
            articleId: item.articleId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
          })),
        },
      },
      include: orderInclude,
    });

    if (!asDraft) {
      await reserveStock(tx, order.id, merged, user.id);
      await notify(
        tx,
        'Nouvelle commande',
        `La commande ${order.orderNumber} de ${customer.name} (${subtotal} Ar) attend votre validation.`,
        { type: 'NOUVELLE_COMMANDE', roles: ['FACTURIER'], orderId: order.id },
      );
    }

    await recordAudit(tx, {
      userId: user.id,
      action: asDraft ? 'ORDER_DRAFT_CREATE' : 'ORDER_CREATE',
      entity: 'Order',
      entityId: order.id,
      newValue: { orderNumber, total: subtotal, items: priced.length, status: order.status },
    });

    return order;
  });
}

/** Valide un brouillon : vérifie le stock puis réserve les quantités. */
export async function submitOrder(orderId: string, user: Actor): Promise<OrderWithRelations> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: orderInclude });
    if (!order) throw notFound('Commande');
    if (order.status !== 'BROUILLON') throw conflict('Seul un brouillon peut être validé');
    if (!order.items.length) throw unprocessable('La commande ne contient aucun article');

    await reserveStock(
      tx,
      order.id,
      order.items.map((item) => ({ articleId: item.articleId, quantity: item.quantity })),
      user.id,
    );

    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: 'COMMANDE', reservedAt: new Date() },
      include: orderInclude,
    });

    await notify(
      tx,
      'Nouvelle commande',
      `La commande ${updated.orderNumber} attend une facturation.`,
      { type: 'NOUVELLE_COMMANDE', roles: ['FACTURIER'], orderId: updated.id },
    );

    await recordAudit(tx, {
      userId: user.id,
      action: 'ORDER_SUBMIT',
      entity: 'Order',
      entityId: orderId,
      oldValue: { status: 'BROUILLON' },
      newValue: { status: 'COMMANDE' },
    });

    return updated;
  });
}

/** Modification d'un brouillon uniquement (aucun effet sur le stock). */
export async function updateDraftOrder(
  orderId: string,
  input: UpdateOrderInput,
  user: Actor,
): Promise<OrderWithRelations> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: orderInclude });
    if (!order) throw notFound('Commande');
    if (order.status !== 'BROUILLON') {
      throw conflict('Seul un brouillon peut être modifié (les commandes validées sont réservées)');
    }

    const customer = input.customerId
      ? await tx.customer.findUnique({ where: { id: input.customerId } })
      : await tx.customer.findUnique({ where: { id: order.customerId } });
    if (!customer || !customer.isActive) throw notFound('Client');

    const merged = input.items ? mergeItems(input.items) : [];
    const priced = input.items ? await loadPricedItems(tx, merged) : [];
    const subtotal = input.items
      ? round2(priced.reduce((sum, item) => sum + item.lineTotal, 0))
      : Number(order.subtotal);

    if (input.items) {
      await tx.orderItem.deleteMany({ where: { orderId } });
      await tx.orderItem.createMany({
        data: priced.map((item) => ({
          orderId,
          articleId: item.articleId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        })),
      });
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        customerId: customer.id,
        subtotal,
        total: subtotal,
        ...(input.comments !== undefined ? { comments: input.comments } : {}),
        ...(input.deliveryAddress !== undefined ? { deliveryAddress: input.deliveryAddress } : {}),
        ...(input.deliveryPlace !== undefined ? { deliveryPlace: input.deliveryPlace } : {}),
        ...(input.recipientName !== undefined ? { recipientName: input.recipientName } : {}),
        ...(input.recipientPhone !== undefined ? { recipientPhone: input.recipientPhone } : {}),
      },
      include: orderInclude,
    });

    await recordAudit(tx, {
      userId: user.id,
      action: 'ORDER_UPDATE',
      entity: 'Order',
      entityId: orderId,
      newValue: { total: subtotal, items: priced.length },
    });

    return updated;
  });
}

// ---------------------------------------------------------------------------
// Annulation
// ---------------------------------------------------------------------------

export async function cancelOrder(
  orderId: string,
  input: CancelOrderInput,
  user: Actor,
): Promise<OrderWithRelations> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: orderInclude });
    if (!order) throw notFound('Commande');
    if (order.status === 'ANNULEE') throw conflict('Cette commande est déjà annulée');
    if (order.status === 'LIVREE') throw conflict('Une commande livrée ne peut pas être annulée');

    if (RELEASED_STATUSES.includes(order.status)) {
      throw unprocessable(
        'Cette commande est déjà sortie du magasin : utilisez la procédure de retour (annulation avec restitution de stock) plutôt qu\'une annulation simple.',
        { status: order.status },
      );
    }

    if (RESERVABLE_STATUSES.includes(order.status)) {
      await releaseStock(tx, order, user.id);
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: 'ANNULEE', cancelledAt: new Date(), cancelReason: input.reason },
      include: orderInclude,
    });

    await notify(
      tx,
      'Commande annulée',
      `La commande ${updated.orderNumber} a été annulée : ${input.reason}`,
      {
        type: 'STATUT_COMMANDE',
        orderId,
        userIds: [updated.commercialId],
      },
    );

    if (order.invoice) {
      await notify(
        tx,
        'Facture à traiter',
        `La commande ${updated.orderNumber} annulée avait une facture (${order.invoice.invoiceNumber}).`,
        { type: 'STATUT_COMMANDE', roles: ['FACTURIER'], orderId },
      );
    }

    await recordAudit(tx, {
      userId: user.id,
      action: 'ORDER_CANCEL',
      entity: 'Order',
      entityId: orderId,
      oldValue: { status: order.status },
      newValue: { status: 'ANNULEE', reason: input.reason },
    });

    return updated;
  });
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

export async function listOrders(query: ListOrdersQuery, user: Actor) {
  const where: Prisma.OrderWhereInput = {
    ...(query.status ? { status: { in: query.status } } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.mine || user.role === 'COMMERCIAL' ? { commercialId: user.id } : {}),
    ...(query.commercialId && user.role === 'ADMIN' ? { commercialId: query.commercialId } : {}),
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
            { orderNumber: { contains: query.search, mode: 'insensitive' } },
            { customer: { name: { contains: query.search, mode: 'insensitive' } } },
            { customer: { phone: { contains: query.search, mode: 'insensitive' } } },
            { customer: { contactName: { contains: query.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true, city: true } },
        commercial: { select: { id: true, firstName: true, lastName: true } },
        items: { select: { quantity: true } },
        invoice: { select: { invoiceNumber: true, status: true } },
        delivery: { select: { deliveryNumber: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return { total, items };
}

export async function getOrder(id: string): Promise<{
  order: OrderWithRelations;
  movements: Awaited<ReturnType<typeof prisma.stockMovement.findMany>>;
}> {
  const order = await prisma.order.findUnique({ where: { id }, include: orderInclude });
  if (!order) throw notFound('Commande');

  const movements = await prisma.stockMovement.findMany({
    where: { orderId: id },
    include: {
      article: { select: { id: true, sku: true, name: true } },
      user: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return { order, movements };
}

/**
 * Met à jour le lieu de livraison et les contacts du destinataire.
 * Utilisé par le facturier (depuis la facture) et le commercial (sa commande).
 */
export async function updateDeliveryInfo(
  orderId: string,
  input: DeliveryInfoInput,
  user: Actor,
): Promise<OrderWithRelations> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: orderInclude });
    if (!order) throw notFound('Commande');
    if (order.status === 'ANNULEE') {
      throw unprocessable('Impossible de modifier une commande annulée', { status: order.status });
    }

    const data: {
      deliveryAddress?: string | null;
      deliveryPlace?: string | null;
      recipientName?: string | null;
      recipientPhone?: string | null;
    } = {};
    if (input.deliveryAddress !== undefined) data.deliveryAddress = input.deliveryAddress ?? null;
    if (input.deliveryPlace !== undefined) data.deliveryPlace = input.deliveryPlace ?? null;
    if (input.recipientName !== undefined) data.recipientName = input.recipientName ?? null;
    if (input.recipientPhone !== undefined) data.recipientPhone = input.recipientPhone ?? null;
    if (Object.keys(data).length === 0) {
      throw badRequest('Aucune information de livraison à modifier');
    }

    const updated = await tx.order.update({ where: { id: orderId }, data, include: orderInclude });

    await recordAudit(tx, {
      userId: user.id,
      action: 'ORDER_DELIVERY_UPDATE',
      entity: 'Order',
      entityId: orderId,
      oldValue: {
        deliveryAddress: order.deliveryAddress,
        deliveryPlace: order.deliveryPlace,
        recipientName: order.recipientName,
        recipientPhone: order.recipientPhone,
      },
      newValue: data,
    });

    return updated;
  });
}

/** Change le statut et trace l'opération (utilisé par les phases suivantes). */
export async function setOrderStatus(
  tx: Db,
  orderId: string,
  status: OrderStatus,
  userId: string,
  extra: Partial<Order> = {},
): Promise<Order> {
  return tx.order.update({
    where: { id: orderId },
    data: { status, ...extra },
  });
}
