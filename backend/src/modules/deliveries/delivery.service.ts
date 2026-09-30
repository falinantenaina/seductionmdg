import type { Delivery, Prisma, User } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { conflict, notFound, unprocessable } from '../../lib/errors.js';
import { DELIVERY_STATUS_LABELS } from '../../lib/labels.js';
import { nextNumber } from '../../utils/sequence.js';
import { recordAudit } from '../../utils/audit.js';
import { notify } from '../../utils/notify.js';
import type {
  AssignDeliveryInput,
  CompleteDeliveryInput,
  CreateDeliveryInput,
  FailDeliveryInput,
  ListDeliveriesQuery,
} from './delivery.schemas.js';

type Db = Prisma.TransactionClient;
type Actor = Pick<User, 'id' | 'role'>;

const deliveryInclude = {
  order: {
    include: {
      customer: {
        select: { id: true, name: true, phone: true, address: true, deliveryPlace: true, city: true, contactName: true },
      },
      commercial: { select: { id: true, firstName: true, lastName: true, phone: true } },
      items: { include: { article: { select: { id: true, sku: true, name: true, unit: true } } } },
      invoice: { select: { id: true, invoiceNumber: true, status: true, paidAt: true } },
    },
  },
  deliveryPerson: { select: { id: true, name: true, phone: true, vehicle: true, userId: true, isActive: true } },
  items: { include: { article: { select: { id: true, sku: true, name: true, unit: true } } } },
} satisfies Prisma.DeliveryInclude;

export type DeliveryWithRelations = Prisma.DeliveryGetPayload<{ include: typeof deliveryInclude }>;

const listInclude = {
  order: {
    include: {
      customer: { select: { id: true, name: true, phone: true, city: true } },
      items: { select: { quantity: true } },
      invoice: { select: { invoiceNumber: true, status: true } },
    },
  },
  deliveryPerson: { select: { id: true, name: true, phone: true, vehicle: true, userId: true } },
  items: { select: { quantity: true, quantityDelivered: true } },
} satisfies Prisma.DeliveryInclude;

export type DeliveryListItem = Prisma.DeliveryGetPayload<{ include: typeof listInclude }>;

function statusLabel(status: Delivery['status']): string {
  return DELIVERY_STATUS_LABELS[status] ?? status;
}

async function loadDelivery(tx: Db, id: string): Promise<DeliveryWithRelations> {
  const delivery = await tx.delivery.findUnique({ where: { id }, include: deliveryInclude });
  if (!delivery) throw notFound('Livraison');
  return delivery;
}

/** Vérifie que l'utilisateur est le livreur affecté (l'admin agit pour tous). */
function assertActor(delivery: DeliveryWithRelations, user: Actor): void {
  if (user.role === 'ADMIN') return;
  if (delivery.deliveryPerson?.userId !== user.id) {
    throw unprocessable('Cette livraison ne vous est pas affectée', { deliveryId: delivery.id });
  }
}

// ---------------------------------------------------------------------------
// Fiches de livraison (dispatcher)
// ---------------------------------------------------------------------------

/** Crée la fiche de livraison d'une commande sortie du magasin. */
export async function createDelivery(input: CreateDeliveryInput, user: Actor): Promise<DeliveryWithRelations> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      include: {
        items: { include: { article: { select: { sku: true, name: true } } } },
        customer: { select: { name: true } },
      },
    });

    if (!order) throw notFound('Commande');
    if (!order.items.length) throw unprocessable('La commande ne contient aucun article');
    if (order.status !== 'SORTIE_MAGASIN') {
      throw unprocessable(
        `La commande doit être sortie du magasin avant la création de la fiche (statut actuel : ${order.status})`,
        { status: order.status, expected: 'SORTIE_MAGASIN' },
      );
    }

    const existing = await tx.delivery.findUnique({ where: { orderId: order.id } });
    if (existing) throw conflict(`Une fiche de livraison existe déjà pour cette commande (${existing.deliveryNumber})`);

    const deliveryNumber = await nextNumber(tx, 'delivery', 'LIV');

    let delivery: DeliveryWithRelations;
    try {
      delivery = await tx.delivery.create({
        data: {
          deliveryNumber,
          orderId: order.id,
          status: 'A_LIVRER',
          scheduledAt: input.scheduledAt ?? null,
          instructions: input.instructions ?? null,
          items: {
            create: order.items.map((item) => ({
              articleId: item.articleId,
              designation: `${item.article.sku} — ${item.article.name}`,
              quantity: item.quantity,
            })),
          },
        },
        include: deliveryInclude,
      });
    } catch (error) {
      // Course : deux créations simultanées sur la même commande (orderId unique).
      if ((error as { code?: string })?.code === 'P2002') {
        throw conflict('Une fiche de livraison existe déjà pour cette commande');
      }
      throw error;
    }

    await notify(
      tx,
      'Fiche de livraison créée',
      `La fiche ${deliveryNumber} a été créée pour la commande ${order.orderNumber} (${order.customer.name}) et attend l'affectation d'un livreur.`,
      { type: 'STATUT_COMMANDE', orderId: order.id, userIds: [order.commercialId] },
    );

    await recordAudit(tx, {
      userId: user.id,
      action: 'DELIVERY_CREATE',
      entity: 'Delivery',
      entityId: delivery.id,
      newValue: {
        deliveryNumber,
        orderId: order.id,
        scheduledAt: input.scheduledAt ? input.scheduledAt.toISOString() : null,
        items: order.items.length,
      },
    });

    return delivery;
  });
}

/** Affecte la fiche à un livreur actif : la commande passe en livraison. */
export async function assignDelivery(
  deliveryId: string,
  input: AssignDeliveryInput,
  user: Actor,
): Promise<DeliveryWithRelations> {
  return prisma.$transaction(async (tx) => {
    const delivery = await loadDelivery(tx, deliveryId);

    if (delivery.status !== 'A_LIVRER' && delivery.status !== 'ECHEC') {
      throw conflict(
        `Affectation impossible sur une livraison « ${statusLabel(delivery.status)} »`,
        { status: delivery.status },
      );
    }
    if (delivery.order.status !== 'SORTIE_MAGASIN') {
      throw unprocessable(
        `La commande n'attend plus l'acheminement (statut actuel : ${delivery.order.status})`,
        { status: delivery.order.status },
      );
    }

    const person = await tx.deliveryPerson.findUnique({ where: { id: input.deliveryPersonId } });
    if (!person) throw notFound('Livreur');
    if (!person.isActive) throw unprocessable('Ce livreur est désactivé');

    const updated = await tx.delivery.update({
      where: { id: delivery.id },
      data: {
        status: 'AFFECTEE',
        deliveryPersonId: person.id,
        scheduledAt: input.scheduledAt ?? delivery.scheduledAt,
      },
      include: deliveryInclude,
    });

    await tx.order.update({ where: { id: delivery.orderId }, data: { status: 'EN_LIVRAISON' } });

    if (person.userId) {
      await notify(
        tx,
        'Livraison affectée',
        `La livraison ${delivery.deliveryNumber} (commande ${delivery.order.orderNumber}, ${delivery.order.customer.name}) vous est affectée${
          updated.scheduledAt ? ` pour le ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(updated.scheduledAt)}` : ''
        }.`,
        { type: 'LIVRAISON_AFFECTEE', orderId: delivery.orderId, userIds: [person.userId] },
      );
    }

    await recordAudit(tx, {
      userId: user.id,
      action: 'DELIVERY_ASSIGN',
      entity: 'Delivery',
      entityId: delivery.id,
      oldValue: { status: delivery.status, deliveryPersonId: delivery.deliveryPersonId },
      newValue: { status: 'AFFECTEE', deliveryPersonId: person.id, deliveryPerson: person.name },
    });

    return updated;
  });
}

/** Retire l'affectation (avant le départ) : la fiche repasse « à livrer ». */
export async function unassignDelivery(deliveryId: string, user: Actor): Promise<DeliveryWithRelations> {
  return prisma.$transaction(async (tx) => {
    const delivery = await loadDelivery(tx, deliveryId);

    if (delivery.status !== 'AFFECTEE') {
      throw conflict(`Réaffectation impossible sur une livraison « ${statusLabel(delivery.status)} »`, {
        status: delivery.status,
      });
    }

    const updated = await tx.delivery.update({
      where: { id: delivery.id },
      data: { status: 'A_LIVRER', deliveryPersonId: null },
      include: deliveryInclude,
    });

    await tx.order.update({ where: { id: delivery.orderId }, data: { status: 'SORTIE_MAGASIN' } });

    await notify(
      tx,
      'Affectation retirée',
      `La livraison ${delivery.deliveryNumber} n'est plus affectée et attend un nouveau livreur.`,
      { type: 'STATUT_COMMANDE', orderId: delivery.orderId, roles: ['DISPATCHER'] },
    );

    await recordAudit(tx, {
      userId: user.id,
      action: 'DELIVERY_UNASSIGN',
      entity: 'Delivery',
      entityId: delivery.id,
      oldValue: { status: 'AFFECTEE', deliveryPersonId: delivery.deliveryPersonId },
      newValue: { status: 'A_LIVRER', deliveryPersonId: null },
    });

    return updated;
  });
}

// ---------------------------------------------------------------------------
// Exécution (livreur)
// ---------------------------------------------------------------------------

/** Départ du livreur : la fiche passe « en cours ». */
export async function startDelivery(deliveryId: string, user: Actor): Promise<DeliveryWithRelations> {
  return prisma.$transaction(async (tx) => {
    const delivery = await loadDelivery(tx, deliveryId);
    assertActor(delivery, user);

    if (delivery.status !== 'AFFECTEE') {
      throw conflict(`Démarrage impossible sur une livraison « ${statusLabel(delivery.status)} »`, {
        status: delivery.status,
      });
    }

    const updated = await tx.delivery.update({
      where: { id: delivery.id },
      data: { status: 'EN_COURS' },
      include: deliveryInclude,
    });

    await recordAudit(tx, {
      userId: user.id,
      action: 'DELIVERY_START',
      entity: 'Delivery',
      entityId: delivery.id,
      oldValue: { status: 'AFFECTEE' },
      newValue: { status: 'EN_COURS' },
    });

    return updated;
  });
}

/**
 * Livraison effective : quantités livrées par ligne, la fiche et la commande
 * passent « livrées ». Les lignes non renseignées sont livrées intégralement.
 */
export async function completeDelivery(
  deliveryId: string,
  input: CompleteDeliveryInput,
  user: Actor,
): Promise<DeliveryWithRelations> {
  return prisma.$transaction(async (tx) => {
    const delivery = await loadDelivery(tx, deliveryId);
    assertActor(delivery, user);

    if (delivery.status !== 'EN_COURS') {
      throw conflict(`Validation impossible sur une livraison « ${statusLabel(delivery.status)} »`, {
        status: delivery.status,
      });
    }

    const overrides = new Map((input.items ?? []).map((line) => [line.deliveryItemId, line.quantityDelivered]));
    const lineIds = new Set(delivery.items.map((line) => line.id));
    for (const [lineId] of overrides) {
      if (!lineIds.has(lineId)) throw unprocessable('Ligne de livraison inconnue sur cette fiche', { deliveryItemId: lineId });
    }

    const totalDelivered = delivery.items.reduce((sum, line) => {
      const quantity = overrides.get(line.id) ?? line.quantity;
      if (quantity > line.quantity) {
        throw unprocessable(
          `Quantité livrée supérieure à la quantité prévue pour ${line.designation} (prévue : ${line.quantity}, livrée : ${quantity})`,
          { deliveryItemId: line.id, quantity: line.quantity, delivered: quantity },
        );
      }
      return sum + quantity;
    }, 0);

    if (delivery.items.length === 0) throw unprocessable('La fiche ne contient aucune ligne');
    if (totalDelivered === 0) {
      throw unprocessable('Aucune quantité livrée : utilisez le signalement d\'échec de livraison');
    }

    for (const line of delivery.items) {
      await tx.deliveryItem.update({
        where: { id: line.id },
        data: { quantityDelivered: overrides.get(line.id) ?? line.quantity },
      });
    }

    const deliveredAt = input.deliveredAt ?? new Date();
    const updated = await tx.delivery.update({
      where: { id: delivery.id },
      data: { status: 'LIVREE', deliveredAt, observations: input.observations ?? delivery.observations },
      include: deliveryInclude,
    });

    await tx.order.update({ where: { id: delivery.orderId }, data: { status: 'LIVREE' } });

    await notify(
      tx,
      'Livraison effectuée',
      `La commande ${delivery.order.orderNumber} (${delivery.order.customer.name}) a été livrée le ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(deliveredAt)}.`,
      { type: 'STATUT_COMMANDE', orderId: delivery.orderId, userIds: [delivery.order.commercialId] },
    );
    await notify(
      tx,
      'Livraison effectuée',
      `La fiche ${delivery.deliveryNumber} est livrée (commande ${delivery.order.orderNumber}).`,
      { type: 'STATUT_COMMANDE', orderId: delivery.orderId, roles: ['DISPATCHER'] },
    );

    await recordAudit(tx, {
      userId: user.id,
      action: 'DELIVERY_COMPLETE',
      entity: 'Delivery',
      entityId: delivery.id,
      oldValue: { status: 'EN_COURS' },
      newValue: {
        status: 'LIVREE',
        deliveredAt: deliveredAt.toISOString(),
        totalOrdered: delivery.items.reduce((sum, line) => sum + line.quantity, 0),
        totalDelivered,
        observations: input.observations ?? null,
      },
    });

    return updated;
  });
}

/** Échec de livraison : la fiche est cloturée, la commande repart au magasin. */
export async function failDelivery(
  deliveryId: string,
  input: FailDeliveryInput,
  user: Actor,
): Promise<DeliveryWithRelations> {
  return prisma.$transaction(async (tx) => {
    const delivery = await loadDelivery(tx, deliveryId);
    assertActor(delivery, user);

    if (delivery.status !== 'EN_COURS') {
      throw conflict(`Échec impossible sur une livraison « ${statusLabel(delivery.status)} »`, {
        status: delivery.status,
      });
    }

    const updated = await tx.delivery.update({
      where: { id: delivery.id },
      data: { status: 'ECHEC', observations: input.reason },
      include: deliveryInclude,
    });

    // Les marchandises restent dans le véhicule : le magasinier enregistrera le
    // retour physique via l'entrée/retour de stock. La commande est réexpédiable.
    await tx.order.update({ where: { id: delivery.orderId }, data: { status: 'SORTIE_MAGASIN' } });

    await notify(
      tx,
      'Échec de livraison',
      `La livraison ${delivery.deliveryNumber} a échoué (${input.reason}). La commande ${delivery.order.orderNumber} attend une nouvelle affectation.`,
      { type: 'STATUT_COMMANDE', orderId: delivery.orderId, roles: ['DISPATCHER'] },
    );

    await recordAudit(tx, {
      userId: user.id,
      action: 'DELIVERY_FAIL',
      entity: 'Delivery',
      entityId: delivery.id,
      oldValue: { status: 'EN_COURS' },
      newValue: { status: 'ECHEC', reason: input.reason },
    });

    return updated;
  });
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

export async function listDeliveries(query: ListDeliveriesQuery, user: Actor) {
  const where: Prisma.DeliveryWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.deliveryPersonId ? { deliveryPersonId: query.deliveryPersonId } : {}),
    ...(query.orderId ? { orderId: query.orderId } : {}),
    ...(query.mine || user.role === 'LIVREUR' ? { deliveryPerson: { userId: user.id } } : {}),
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
            { deliveryNumber: { contains: query.search, mode: 'insensitive' } },
            { order: { orderNumber: { contains: query.search, mode: 'insensitive' } } },
            { order: { customer: { name: { contains: query.search, mode: 'insensitive' } } } },
            { order: { customer: { phone: { contains: query.search, mode: 'insensitive' } } } },
            { deliveryPerson: { name: { contains: query.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.delivery.count({ where }),
    prisma.delivery.findMany({
      where,
      include: listInclude,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return { total, items };
}

export async function getDelivery(id: string, user: Actor): Promise<DeliveryWithRelations> {
  const delivery = await prisma.delivery.findUnique({ where: { id }, include: deliveryInclude });
  if (!delivery) throw notFound('Livraison');
  if (user.role === 'LIVREUR' && delivery.deliveryPerson?.userId !== user.id) throw notFound('Livraison');
  return delivery;
}
