import { Prisma, type StockMovementType } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { unprocessable, notFound } from '../../lib/errors.js';
import { notify } from '../../utils/notify.js';

type Db = Prisma.TransactionClient;

export interface LockedArticle {
  id: string;
  sku: string;
  name: string;
  stockPhysical: number;
  stockReserved: number;
  alertThreshold: number;
  isActive: boolean;
}

export interface StockSnapshot {
  stockPhysical: number;
  stockReserved: number;
  stockAvailable: number;
}

export function computeAvailable(physical: number, reserved: number): number {
  return physical - reserved;
}

/**
 * Verrouille les articles dans un ordre déterminé (tri par id) pour éviter
 * les deadlocks lors de réservations concurrentes.
 * À appeler OBLIGATOIREMENT dans une transaction Prisma.
 */
export async function lockArticles(tx: Db, articleIds: string[]): Promise<Map<string, LockedArticle>> {
  const unique = [...new Set(articleIds)].sort();
  if (!unique.length) return new Map();

  const sql = Prisma.sql`
    SELECT id, sku, name, "stockPhysical", "stockReserved", "alertThreshold", "isActive"
    FROM "Article"
    WHERE id IN (${Prisma.join(unique)})
    ORDER BY id
    FOR UPDATE
  `;
  const rows = await tx.$queryRaw<LockedArticle[]>(sql);
  return new Map(rows.map((row) => [row.id, row]));
}

interface MovementParams {
  type: StockMovementType;
  quantity: number;
  physicalDelta?: number;
  reservedDelta?: number;
  orderId?: string | null;
  userId: string;
  comment?: string | null;
}

/** Mouvements par défaut déduits du type (voir cahier des charges §14). */
function resolveDeltas(type: StockMovementType, quantity: number): { physical: number; reserved: number } {
  switch (type) {
    case 'ENTREE':
    case 'RETOUR':
      return { physical: quantity, reserved: 0 };
    case 'SORTIE':
      return { physical: -quantity, reserved: -quantity };
    case 'RESERVATION':
      return { physical: 0, reserved: quantity };
    case 'ANNULATION_RESERVATION':
      return { physical: 0, reserved: -quantity };
    case 'AJUSTEMENT':
      return { physical: 0, reserved: 0 };
  }
}

/**
 * POINT D'UNIQUE d'écriture du stock : applique un mouvement sur un article
 * déjà verrouillé (FOR UPDATE), persiste le nouveau stock et historise
 * l'opération avec l'ancien et le nouveau état.
 */
export async function applyMovement(
  tx: Db,
  article: LockedArticle,
  params: MovementParams,
): Promise<LockedArticle> {
  const defaults = resolveDeltas(params.type, params.quantity);
  const physicalDelta = params.physicalDelta ?? defaults.physical;
  const reservedDelta = params.reservedDelta ?? defaults.reserved;

  const newPhysical = article.stockPhysical + physicalDelta;
  const newReserved = article.stockReserved + reservedDelta;

  if (newPhysical < 0) {
    throw unprocessable(
      `Stock physique insuffisant pour ${article.sku} (demandé : ${Math.abs(physicalDelta)}, disponible : ${article.stockPhysical})`,
    );
  }
  if (newReserved < 0) {
    throw unprocessable(
      `Réservation invalide pour ${article.sku} (réservé : ${article.stockReserved}, retrait : ${Math.abs(reservedDelta)})`,
    );
  }

  const updated = await tx.article.update({
    where: { id: article.id },
    data: { stockPhysical: newPhysical, stockReserved: newReserved },
    select: {
      id: true,
      sku: true,
      name: true,
      stockPhysical: true,
      stockReserved: true,
      alertThreshold: true,
      isActive: true,
    },
  });

  await tx.stockMovement.create({
    data: {
      type: params.type,
      articleId: article.id,
      orderId: params.orderId ?? null,
      quantity: params.quantity,
      previousPhysical: article.stockPhysical,
      newPhysical,
      previousReserved: article.stockReserved,
      newReserved,
      userId: params.userId,
      comment: params.comment ?? null,
    },
  });

  await maybeNotifyLowStock(tx, article, newPhysical);

  return updated;
}

/** Alerte une seule fois au franchissement du seuil. */
async function maybeNotifyLowStock(tx: Db, article: LockedArticle, newPhysical: number): Promise<void> {
  if (article.alertThreshold <= 0) return;
  const wasAbove = article.stockPhysical > article.alertThreshold;
  const isBelow = newPhysical <= article.alertThreshold;
  if (!wasAbove || !isBelow) return;

  await notify(
    tx,
    'Stock faible',
    `${article.sku} - ${article.name} : ${newPhysical} unité(s) restante(s) (seuil : ${article.alertThreshold}).`,
    { type: 'STOCK_FAIBLE', roles: ['ADMIN', 'MAGASINIER'] },
  );
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

export interface StockListFilters {
  page: number;
  pageSize: number;
  search?: string;
  categoryId?: string;
  lowStock?: boolean;
  includeInactive?: boolean;
}

export async function listStocks(filters: StockListFilters) {
  const where: Prisma.ArticleWhereInput = {
    ...(filters.includeInactive ? {} : { isActive: true }),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.search
      ? {
          OR: [
            { sku: { contains: filters.search, mode: 'insensitive' } },
            { name: { contains: filters.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, articles] = await Promise.all([
    prisma.article.count({ where }),
    prisma.article.findMany({
      where,
      include: { category: { select: { id: true, name: true } } },
      orderBy: [{ name: 'asc' }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
  ]);

  let items = articles.map((article) => ({
    ...article,
    stockAvailable: computeAvailable(article.stockPhysical, article.stockReserved),
    lowStock: article.stockPhysical <= article.alertThreshold,
  }));

  if (filters.lowStock) {
    items = items.filter((item) => item.lowStock);
  }

  return { total, items };
}

export async function listMovements(filters: {
  page: number;
  pageSize: number;
  search?: string;
  articleId?: string;
  orderId?: string;
  type?: StockMovementType;
  from?: Date;
  to?: Date;
}) {
  const where: Prisma.StockMovementWhereInput = {
    ...(filters.articleId ? { articleId: filters.articleId } : {}),
    ...(filters.orderId ? { orderId: filters.orderId } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.from || filters.to
      ? {
          createdAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : {}),
    ...(filters.search
      ? {
          OR: [
            { article: { sku: { contains: filters.search, mode: 'insensitive' } } },
            { article: { name: { contains: filters.search, mode: 'insensitive' } } },
            { user: { lastName: { contains: filters.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({
      where,
      include: {
        article: { select: { id: true, sku: true, name: true, unit: true } },
        user: { select: { id: true, firstName: true, lastName: true, role: true } },
        order: { select: { id: true, orderNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
  ]);

  return { total, items };
}

// ---------------------------------------------------------------------------
// Écritures manuelles (magasin / administration)
// ---------------------------------------------------------------------------

export async function entryStock(params: {
  articleId: string;
  quantity: number;
  comment?: string;
  userId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const articles = await lockArticles(tx, [params.articleId]);
    const article = articles.get(params.articleId);
    if (!article) throw notFound('Article');

    return applyMovement(tx, article, {
      type: 'ENTREE',
      quantity: params.quantity,
      userId: params.userId,
      comment: params.comment ?? 'Entrée de stock manuelle',
    });
  });
}

/** Ajustement : force le stock physique à une valeur donnée (inventaire). */
export async function adjustStock(params: {
  articleId: string;
  newPhysical: number;
  comment?: string;
  userId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const articles = await lockArticles(tx, [params.articleId]);
    const article = articles.get(params.articleId);
    if (!article) throw notFound('Article');

    if (params.newPhysical < article.stockReserved) {
      throw unprocessable(
        `Impossible de passer sous la quantité réservée (${article.stockReserved} unité(s) réservée(s))`,
      );
    }

    return applyMovement(tx, article, {
      type: 'AJUSTEMENT',
      quantity: Math.abs(params.newPhysical - article.stockPhysical),
      physicalDelta: params.newPhysical - article.stockPhysical,
      userId: params.userId,
      comment: params.comment ?? 'Ajustement d\'inventaire',
    });
  });
}
