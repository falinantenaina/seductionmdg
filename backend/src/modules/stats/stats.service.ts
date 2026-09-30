import type { OrderStatus, Prisma, User } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

type Actor = Pick<User, 'id' | 'role'>;

/** Commandes encore en cours de traitement (hors brouillon, sortie et clôtures). */
const PENDING_STATUSES: OrderStatus[] = ['COMMANDE', 'EN_FACTURATION', 'FACTUREE', 'A_PREPARER'];
const OPEN_DELIVERY_STATUSES = ['A_LIVRER', 'AFFECTEE', 'EN_COURS'] as const;

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function startOfMonth(date: Date): Date {
  const result = startOfDay(date);
  result.setDate(1);
  return result;
}

function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function lastDays(count: number): string[] {
  const days: string[] = [];
  const cursor = startOfDay(new Date());
  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(cursor);
    date.setDate(cursor.getDate() - index);
    days.push(isoDate(date));
  }
  return days;
}

/** Agrège des valeurs par jour à partir de timestamps (sans SQL brut). */
function bucketByDay(days: string[]): Record<string, { orders: number; revenue: number }> {
  return Object.fromEntries(days.map((day) => [day, { orders: 0, revenue: 0 }]));
}

// ---------------------------------------------------------------------------
// Tableau de bord
// ---------------------------------------------------------------------------

export async function dashboard(user: Actor, days = 14) {
  const now = new Date();
  const today = startOfDay(now);
  const monthStart = startOfMonth(now);
  const dates = lastDays(days);
  const seriesStart = startOfDay(new Date(`${dates[0] ?? ''}T00:00:00`));

  const orderWhere: Prisma.OrderWhereInput = user.role === 'COMMERCIAL' ? { commercialId: user.id } : {};
  const invoiceWhere: Prisma.InvoiceWhereInput =
    user.role === 'COMMERCIAL' ? { order: { commercialId: user.id } } : {};
  const deliveryWhere: Prisma.DeliveryWhereInput =
    user.role === 'LIVREUR' ? { deliveryPerson: { userId: user.id } } : {};

  const [stockRow, orderTotal, orderMonth, orderToday, statusGroups, revenueAgg, revenueMonth, revenueToday, deliveriesOpen, deliveriesDone, deliveriesFailed, customerCount, usersRow, seriesOrders, seriesPaid, recentOrders, lowStock] =
    await Promise.all([
      prisma.$queryRaw<Array<{ articles: number; low: number; value: number }>>`
        SELECT COUNT(*)::int AS articles,
               COUNT(*) FILTER (WHERE "stockPhysical" <= "alertThreshold")::int AS low,
               COALESCE(SUM("stockPhysical" * price), 0)::float AS value
        FROM "Article"
        WHERE "isActive" = true
      `,
      prisma.order.count({ where: orderWhere }),
      prisma.order.count({ where: { ...orderWhere, createdAt: { gte: monthStart } } }),
      prisma.order.count({ where: { ...orderWhere, createdAt: { gte: today } } }),
      prisma.order.groupBy({
        by: ['status'],
        where: orderWhere,
        _count: { _all: true },
      }),
      prisma.invoice.aggregate({
        where: { ...invoiceWhere, status: 'PAYEE' },
        _sum: { total: true },
      }),
      prisma.invoice.aggregate({
        where: { ...invoiceWhere, status: 'PAYEE', paidAt: { gte: monthStart } },
        _sum: { total: true },
      }),
      prisma.invoice.aggregate({
        where: { ...invoiceWhere, status: 'PAYEE', paidAt: { gte: today } },
        _sum: { total: true },
      }),
      prisma.delivery.count({ where: { ...deliveryWhere, status: { in: [...OPEN_DELIVERY_STATUSES] } } }),
      prisma.delivery.count({
        where: { ...deliveryWhere, status: 'LIVREE', deliveredAt: { gte: monthStart } },
      }),
      prisma.delivery.count({ where: { ...deliveryWhere, status: 'ECHEC' } }),
      prisma.customer.count({ where: { isActive: true } }),
      prisma.user.aggregate({ where: { isActive: true }, _count: { _all: true } }),
      prisma.order.findMany({
        where: { ...orderWhere, createdAt: { gte: seriesStart } },
        select: { createdAt: true },
      }),
      prisma.invoice.findMany({
        where: { ...invoiceWhere, status: 'PAYEE', paidAt: { gte: seriesStart } },
        select: { paidAt: true, total: true },
      }),
      prisma.order.findMany({
        where: orderWhere,
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          createdAt: true,
          customer: { select: { name: true } },
        },
      }),
      prisma.$queryRaw<Array<{ id: string; sku: string; name: string; stockPhysical: number; alertThreshold: number }>>`
        SELECT id, sku, name, "stockPhysical", "alertThreshold"
        FROM "Article"
        WHERE "isActive" = true AND "stockPhysical" <= "alertThreshold"
        ORDER BY "stockPhysical" ASC
        LIMIT 6
      `,
    ]);

  const byStatus = Object.fromEntries(statusGroups.map((row) => [row.status, row._count._all]));
  const pending = PENDING_STATUSES.reduce((sum, status) => sum + (byStatus[status] ?? 0), 0);

  const buckets = bucketByDay(dates);
  for (const order of seriesOrders) {
    const key = isoDate(order.createdAt);
    if (buckets[key]) buckets[key].orders += 1;
  }
  for (const invoice of seriesPaid) {
    if (!invoice.paidAt) continue;
    const key = isoDate(invoice.paidAt);
    if (buckets[key]) buckets[key].revenue += Number(invoice.total);
  }

  return {
    generatedAt: now.toISOString(),
    range: { days, from: dates[0] ?? isoDate(now), to: dates[dates.length - 1] ?? isoDate(now) },
    scope: user.role,
    orders: { total: orderTotal, month: orderMonth, today: orderToday, pending, byStatus },
    revenue: {
      total: Number(revenueAgg._sum.total ?? 0),
      month: Number(revenueMonth._sum.total ?? 0),
      today: Number(revenueToday._sum.total ?? 0),
    },
    stock: {
      articles: stockRow[0]?.articles ?? 0,
      lowStock: stockRow[0]?.low ?? 0,
      value: stockRow[0]?.value ?? 0,
    },
    deliveries: {
      open: deliveriesOpen,
      deliveredMonth: deliveriesDone,
      failed: deliveriesFailed,
    },
    people: { customers: customerCount, users: usersRow._count._all },
    series: dates.map((date) => ({ date, ...buckets[date] })),
    recentOrders,
      lowStock: lowStock,
  };
}

// ---------------------------------------------------------------------------
// Rapport de statistiques (administration)
// ---------------------------------------------------------------------------

export async function report(query: { from?: Date; to?: Date }) {
  const to = query.to ?? startOfDay(new Date());
  const from = query.from ?? new Date(startOfDay(to).getTime() - 29 * 24 * 60 * 60 * 1000);
  const fromDate = startOfDay(from);
  const toDate = new Date(startOfDay(to).getTime() + 24 * 60 * 60 * 1000 - 1);

  const dates = (() => {
    const list: string[] = [];
    const cursor = startOfDay(fromDate);
    while (cursor <= toDate && list.length <= 120) {
      list.push(isoDate(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return list;
  })();

  const [ordersInRange, paidInRange, itemsInRange, statusGroups, deliveryGroups, movementGroups, exitsInRange, failedInRange] =
    await Promise.all([
      prisma.order.findMany({
        where: { createdAt: { gte: fromDate, lte: toDate } },
        select: { createdAt: true, status: true },
      }),
      prisma.invoice.findMany({
        where: { status: 'PAYEE', paidAt: { gte: fromDate, lte: toDate } },
        select: { paidAt: true, total: true },
      }),
      prisma.orderItem.findMany({
        where: { order: { createdAt: { gte: fromDate, lte: toDate }, status: { not: 'ANNULEE' } } },
        select: {
          quantity: true,
          lineTotal: true,
          article: {
            select: { sku: true, name: true, category: { select: { name: true } } },
          },
        },
      }),
      prisma.order.groupBy({
        by: ['status'],
        where: { createdAt: { gte: fromDate, lte: toDate } },
        _count: { _all: true },
      }),
      prisma.delivery.groupBy({
        by: ['status'],
        where: { createdAt: { gte: fromDate, lte: toDate } },
        _count: { _all: true },
      }),
      prisma.stockMovement.groupBy({
        by: ['type'],
        where: { createdAt: { gte: fromDate, lte: toDate } },
        _count: { _all: true },
      }),
      prisma.order.count({
        where: { releasedAt: { gte: fromDate, lte: toDate }, status: { in: ['SORTIE_MAGASIN', 'EN_LIVRAISON', 'LIVREE'] } },
      }),
      prisma.delivery.count({ where: { status: 'ECHEC', createdAt: { gte: fromDate, lte: toDate } } }),
    ]);

  const buckets = bucketByDay(dates);
  for (const order of ordersInRange) {
    const key = isoDate(order.createdAt);
    if (buckets[key]) buckets[key].orders += 1;
  }
  let revenue = 0;
  for (const invoice of paidInRange) {
    if (!invoice.paidAt) continue;
    const key = isoDate(invoice.paidAt);
    const amount = Number(invoice.total);
    revenue += amount;
    if (buckets[key]) buckets[key].revenue += amount;
  }

  const byArticle = new Map<string, { sku: string; name: string; quantity: number; revenue: number }>();
  const byCategory = new Map<string, { name: string; quantity: number; revenue: number }>();
  let orderedQuantity = 0;

  for (const item of itemsInRange) {
    const sku = item.article?.sku ?? 'Sans référence';
    const articleKey = `${sku}`;
    const article = byArticle.get(articleKey) ?? { sku, name: item.article?.name ?? 'Article supprimé', quantity: 0, revenue: 0 };
    article.quantity += item.quantity;
    article.revenue += Number(item.lineTotal);
    byArticle.set(articleKey, article);

    const categoryName = item.article?.category?.name ?? 'Sans catégorie';
    const category = byCategory.get(categoryName) ?? { name: categoryName, quantity: 0, revenue: 0 };
    category.quantity += item.quantity;
    category.revenue += Number(item.lineTotal);
    byCategory.set(categoryName, category);

    orderedQuantity += item.quantity;
  }

  const orderCount = ordersInRange.length;

  return {
    range: { from: fromDate.toISOString(), to: toDate.toISOString(), days: dates.length },
    kpis: {
      revenue,
      orders: orderCount,
      avgBasket: orderCount ? revenue / orderCount : 0,
      delivered: ordersInRange.filter((order) => order.status === 'LIVREE').length,
      exits: exitsInRange,
      failedDeliveries: failedInRange,
      orderedQuantity,
    },
    series: dates.map((date) => ({ date, ...buckets[date] })),
    topArticles: [...byArticle.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8),
    byCategory: [...byCategory.values()].sort((a, b) => b.revenue - a.revenue),
    ordersByStatus: statusGroups.map((row) => ({ status: row.status, count: row._count._all })),
    deliveriesByStatus: deliveryGroups.map((row) => ({ status: row.status, count: row._count._all })),
    movementsByType: movementGroups.map((row) => ({ type: row.type, count: row._count._all })),
  };
}
