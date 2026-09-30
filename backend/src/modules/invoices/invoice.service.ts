import type { Prisma, User } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { conflict, forbidden, notFound, unprocessable } from '../../lib/errors.js';
import { nextNumber } from '../../utils/sequence.js';
import { recordAudit } from '../../utils/audit.js';
import { notify } from '../../utils/notify.js';
import type {
  CancelInvoiceInput,
  CreateInvoiceInput,
  ListInvoicesQuery,
} from './invoice.schemas.js';

type Actor = Pick<User, 'id' | 'role'>;

const invoiceInclude = {
  customer: {
    select: {
      id: true,
      name: true,
      contactName: true,
      phone: true,
      address: true,
      city: true,
      deliveryPlace: true,
      email: true,
    },
  },
  order: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      createdAt: true,
      deliveryAddress: true,
      deliveryPlace: true,
      recipientName: true,
      recipientPhone: true,
      commercial: { select: { id: true, firstName: true, lastName: true } },
    },
  },
  items: true,
  author: { select: { id: true, firstName: true, lastName: true, role: true } },
} satisfies Prisma.InvoiceInclude;

export type InvoiceWithRelations = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

/** Statuts de commande acceptant une facturation. */
const BILLABLE_STATUSES = ['COMMANDE', 'EN_FACTURATION'] as const;
/** Statuts dont l'état découle de la facture (retour arrière en cas d'annulation). */
const INVOICE_DRIVEN_STATUSES = ['EN_FACTURATION', 'FACTUREE'] as const;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Champs de livraison réellement fournis (les valeurs omises sont ignorées). */
function pickDeliveryData(input: CreateInvoiceInput): {
  deliveryAddress?: string | null;
  deliveryPlace?: string | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
} {
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
  return data;
}

// ---------------------------------------------------------------------------
// Création
// ---------------------------------------------------------------------------

export async function createInvoice(input: CreateInvoiceInput, user: Actor): Promise<InvoiceWithRelations> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      include: {
        items: { include: { article: { select: { id: true, sku: true, name: true } } } },
        invoice: { select: { id: true, invoiceNumber: true } },
        customer: { select: { id: true, name: true, isActive: true } },
      },
    });

    if (!order) throw notFound('Commande');
    if (order.invoice) {
      throw conflict(`La commande ${order.orderNumber} est déjà facturée (${order.invoice.invoiceNumber})`);
    }
    if (!(BILLABLE_STATUSES as readonly string[]).includes(order.status)) {
      throw unprocessable(
        `Impossible de facturer une commande au statut « ${order.status} » (facturation possible depuis COMMANDE ou EN_FACTURATION)`,
        { status: order.status },
      );
    }
    if (!order.customer.isActive) throw unprocessable('Le client de cette commande est inactif');
    if (!order.items.length) throw unprocessable('La commande ne contient aucun article');
    if (user.role === 'COMMERCIAL' && order.commercialId !== user.id) {
      throw forbidden('Vous ne pouvez facturer que vos propres commandes');
    }

    const invoiceNumber = await nextNumber(tx, 'invoice', 'FAC');
    const subtotal = round2(Number(order.subtotal));
    const status = input.saveAsDraft ? 'BROUILLON' : 'EMISE';

    // Le facturier peut renseigner / corriger le lieu de livraison et les contacts
    // au moment de facturer : ces valeurs alimentent la facture PDF et la livraison.
    // L'état de la commande (statut + livraison) est écrit AVANT la création de la
    // facture pour que la réponse reflète l'état réellement enregistré.
    const deliveryData = pickDeliveryData(input);
    const deliveryUpdated = Object.keys(deliveryData).length > 0;
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: input.saveAsDraft ? 'EN_FACTURATION' : 'FACTUREE',
        ...(deliveryUpdated ? deliveryData : {}),
      },
    });

    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        orderId: order.id,
        customerId: order.customerId,
        status,
        issueDate: new Date(),
        dueDate: input.dueDate ?? null,
        subtotal,
        total: round2(Number(order.total)),
        notes: input.notes ?? null,
        authorId: user.id,
        items: {
          create: order.items.map((item) => ({
            articleId: item.articleId,
            designation: `${item.article.sku} — ${item.article.name}`,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            lineTotal: round2(Number(item.lineTotal)),
          })),
        },
      },
      include: invoiceInclude,
    });

    await notify(
      tx,
      input.saveAsDraft ? 'Facture en préparation' : 'Facture émise',
      input.saveAsDraft
        ? `La facture ${invoice.invoiceNumber} de la commande ${order.orderNumber} est en préparation.`
        : `La facture ${invoice.invoiceNumber} (${subtotal} Ar) a été émise pour la commande ${order.orderNumber}.`,
      {
        type: 'FACTURE_VALIDE',
        orderId: order.id,
        userIds: [order.commercialId],
      },
    );

    await recordAudit(tx, {
      userId: user.id,
      action: input.saveAsDraft ? 'INVOICE_DRAFT_CREATE' : 'INVOICE_CREATE',
      entity: 'Invoice',
      entityId: invoice.id,
      newValue: { invoiceNumber, orderId: order.id, total: subtotal, status, deliveryUpdated },
    });

    return invoice;
  });
}

// ---------------------------------------------------------------------------
// Cycle de vie
// ---------------------------------------------------------------------------

/** Passe un brouillon à « émise » : la commande devient FACTUREE. */
export async function issueInvoice(id: string, user: Actor): Promise<InvoiceWithRelations> {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id }, include: invoiceInclude });
    if (!invoice) throw notFound('Facture');
    if (invoice.status !== 'BROUILLON') {
      throw conflict(`Seul un brouillon peut être émis (statut actuel : ${invoice.status})`);
    }

    const updated = await tx.invoice.update({
      where: { id },
      data: { status: 'EMISE', issueDate: new Date() },
      include: invoiceInclude,
    });

    await tx.order.update({ where: { id: invoice.orderId }, data: { status: 'FACTUREE' } });

    await notify(
      tx,
      'Facture émise',
      `La facture ${invoice.invoiceNumber} a été émise pour la commande ${invoice.order.orderNumber}.`,
      { type: 'FACTURE_VALIDE', orderId: invoice.orderId, userIds: [invoice.order.commercial.id] },
    );

    await recordAudit(tx, {
      userId: user.id,
      action: 'INVOICE_ISSUE',
      entity: 'Invoice',
      entityId: id,
      oldValue: { status: invoice.status },
      newValue: { status: 'EMISE' },
    });

    return updated;
  });
}

/** Encaissement : la commande passe « à préparer » (magasin). */
export async function markInvoicePaid(id: string, user: Actor): Promise<InvoiceWithRelations> {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id }, include: invoiceInclude });
    if (!invoice) throw notFound('Facture');
    if (invoice.status === 'PAYEE') throw conflict('Cette facture est déjà payée');
    if (invoice.status === 'ANNULEE') throw conflict('Une facture annulée ne peut pas être payée');
    if (invoice.status === 'BROUILLON') {
      throw unprocessable("Émettez d'abord la facture (brouillon) avant l'encaissement");
    }

    const updated = await tx.invoice.update({
      where: { id },
      data: { status: 'PAYEE', paidAt: new Date() },
      include: invoiceInclude,
    });

    // Encaissement normal : la commande passe « à préparer ». Si elle a déjà
    // quitté le magasin (paiement à la livraison), seul l'état de la facture change.
    const order = await tx.order.findUnique({
      where: { id: invoice.orderId },
      select: { id: true, orderNumber: true, status: true },
    });
    if (!order) throw notFound('Commande');
    const readyToPrepare = order.status === 'FACTUREE';
    if (readyToPrepare) {
      await tx.order.update({ where: { id: order.id }, data: { status: 'A_PREPARER' } });
    }

    await notify(
      tx,
      'Facture payée',
      readyToPrepare
        ? `${invoice.invoiceNumber} encaissée : la commande ${order.orderNumber} est à préparer.`
        : `${invoice.invoiceNumber} encaissée : la commande ${order.orderNumber} (statut ${order.status}) — encaissement après sortie.`,
      { type: 'FACTURE_VALIDE', orderId: order.id, roles: readyToPrepare ? ['MAGASINIER'] : ['DISPATCHER'] },
    );

    await recordAudit(tx, {
      userId: user.id,
      action: 'INVOICE_PAY',
      entity: 'Invoice',
      entityId: id,
      oldValue: { status: invoice.status },
      newValue: { status: 'PAYEE', total: Number(invoice.total) },
    });

    return updated;
  });
}

/** Annulation (brouillon ou émise uniquement) avec motif obligatoire. */
export async function cancelInvoice(
  id: string,
  input: CancelInvoiceInput,
  user: Actor,
): Promise<InvoiceWithRelations> {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id }, include: invoiceInclude });
    if (!invoice) throw notFound('Facture');
    if (invoice.status === 'ANNULEE') throw conflict('Cette facture est déjà annulée');
    if (invoice.status === 'PAYEE') {
      throw unprocessable(
        'Une facture payée ne peut pas être annulée : émettez un avoir depuis la comptabilité.',
        { status: invoice.status },
      );
    }

    const updated = await tx.invoice.update({
      where: { id },
      data: { status: 'ANNULEE', cancelReason: input.reason },
      include: invoiceInclude,
    });

    if ((INVOICE_DRIVEN_STATUSES as readonly string[]).includes(invoice.order.status)) {
      await tx.order.update({ where: { id: invoice.orderId }, data: { status: 'COMMANDE' } });
    }

    await notify(
      tx,
      'Facture annulée',
      `La facture ${invoice.invoiceNumber} a été annulée : ${input.reason}`,
      { type: 'STATUT_COMMANDE', orderId: invoice.orderId, userIds: [invoice.order.commercial.id] },
    );

    await recordAudit(tx, {
      userId: user.id,
      action: 'INVOICE_CANCEL',
      entity: 'Invoice',
      entityId: id,
      oldValue: { status: invoice.status },
      newValue: { status: 'ANNULEE', reason: input.reason },
    });

    return updated;
  });
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

export async function listInvoices(query: ListInvoicesQuery, user: Actor) {
  const where: Prisma.InvoiceWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.orderId ? { orderId: query.orderId } : {}),
    ...(user.role === 'COMMERCIAL' ? { order: { commercialId: user.id } } : {}),
    ...(query.from || query.to
      ? {
          issueDate: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lte: query.to } : {}),
          },
        }
      : {}),
    ...(query.search
      ? {
          OR: [
            { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
            { order: { orderNumber: { contains: query.search, mode: 'insensitive' } } },
            { customer: { name: { contains: query.search, mode: 'insensitive' } } },
            { customer: { phone: { contains: query.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true, city: true } },
        order: { select: { id: true, orderNumber: true, status: true } },
        items: { select: { quantity: true } },
      },
      orderBy: { issueDate: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return { total, items };
}

export async function getInvoice(id: string, user: Actor): Promise<InvoiceWithRelations> {
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: invoiceInclude });
  if (!invoice) throw notFound('Facture');
  if (user.role === 'COMMERCIAL' && invoice.order.commercial.id !== user.id) {
    throw forbidden('Vous ne pouvez consulter que vos propres factures');
  }
  return invoice;
}
