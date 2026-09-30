import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { conflict, notFound } from '../../lib/errors.js';
import { applyMovement, computeAvailable, lockArticles } from '../stocks/stock.service.js';
import type { ArticleBody, ListArticlesQuery, UpdateArticleBody } from './article.schemas.js';

const sortFields = {
  name: 'name',
  sku: 'sku',
  price: 'price',
  stock: 'stockPhysical',
} as const;

export async function listArticles(query: ListArticlesQuery) {
  const where: Prisma.ArticleWhereInput = {
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.unit ? { unit: query.unit } : {}),
    ...(query.search
      ? {
          OR: [
            { sku: { contains: query.search, mode: 'insensitive' } },
            { name: { contains: query.search, mode: 'insensitive' } },
            { description: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, articles] = await Promise.all([
    prisma.article.count({ where }),
    prisma.article.findMany({
      where,
      include: { category: { select: { id: true, name: true, slug: true } } },
      orderBy: [
        { [sortFields[query.sort]]: query.order } as Prisma.ArticleOrderByWithRelationInput,
      ],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  let items = articles.map((article) => ({
    ...article,
    stockAvailable: computeAvailable(article.stockPhysical, article.stockReserved),
    lowStock: article.stockPhysical <= article.alertThreshold,
  }));

  if (query.lowStock) items = items.filter((item) => item.lowStock);
  if (query.inStock) items = items.filter((item) => item.stockAvailable > 0);

  return { total, items };
}

export async function getArticle(id: string) {
  const article = await prisma.article.findUnique({
    where: { id },
    include: { category: { select: { id: true, name: true, slug: true } } },
  });
  if (!article) throw notFound('Article');
  return { ...article, stockAvailable: computeAvailable(article.stockPhysical, article.stockReserved) };
}

export async function createArticle(input: ArticleBody, userId: string) {
  const existing = await prisma.article.findUnique({ where: { sku: input.sku } });
  if (existing) throw conflict(`La référence "${input.sku}" existe déjà`);

  if (input.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category) throw notFound('Catégorie');
  }

  return prisma.$transaction(async (tx) => {
    const article = await tx.article.create({
      data: {
        sku: input.sku,
        name: input.name,
        description: input.description ?? null,
        categoryId: input.categoryId ?? null,
        unit: input.unit,
        price: input.price,
        alertThreshold: input.alertThreshold,
        imageUrl: input.imageUrl ?? null,
        isActive: input.isActive,
      },
    });

    if (input.initialQuantity > 0) {
      const lockedArticles = await lockArticles(tx, [article.id]);
      const locked = lockedArticles.get(article.id);
      if (locked) {
        await applyMovement(tx, locked, {
          type: 'ENTREE',
          quantity: input.initialQuantity,
          userId,
          comment: 'Stock initial',
        });
      }
    }

    return tx.article.findUniqueOrThrow({
      where: { id: article.id },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
  });
}

/** La mise à jour ne touche JAMAIS au stock : uniquement via les mouvements. */
export async function updateArticle(id: string, input: UpdateArticleBody) {
  const existing = await prisma.article.findUnique({ where: { id } });
  if (!existing) throw notFound('Article');

  if (input.sku && input.sku !== existing.sku) {
    const clash = await prisma.article.findUnique({ where: { sku: input.sku } });
    if (clash) throw conflict(`La référence "${input.sku}" existe déjà`);
  }

  if (input.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category) throw notFound('Catégorie');
  }

  return prisma.article.update({
    where: { id },
    data: {
      ...(input.sku ? { sku: input.sku } : {}),
      ...(input.name ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.unit ? { unit: input.unit } : {}),
      ...(input.price !== undefined ? { price: input.price } : {}),
      ...(input.alertThreshold !== undefined ? { alertThreshold: input.alertThreshold } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    include: { category: { select: { id: true, name: true, slug: true } } },
  });
}

export async function deactivateArticle(id: string) {
  const existing = await prisma.article.findUnique({ where: { id } });
  if (!existing) throw notFound('Article');

  if (existing.stockReserved > 0) {
    throw conflict('Impossible de désactiver un article avec des quantités réservées');
  }

  return prisma.article.update({ where: { id }, data: { isActive: false } });
}
