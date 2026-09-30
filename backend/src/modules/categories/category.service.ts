import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { conflict, notFound } from '../../lib/errors.js';
import { slugify } from '../../utils/slug.js';
import type { CategoryBody, ListCategoriesQuery } from './category.schemas.js';

export async function listCategories(query: ListCategoriesQuery) {
  const where: Prisma.CategoryWhereInput = {
    ...(query.includeInactive ? {} : { isActive: true }),
    ...(query.parentId !== undefined ? { parentId: query.parentId } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { slug: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.category.count({ where }),
    prisma.category.findMany({
      where,
      include: { _count: { select: { articles: true, children: true } } },
      orderBy: { name: 'asc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return { total, items };
}

export async function getCategoryTree() {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    include: { _count: { select: { articles: true } } },
    orderBy: { name: 'asc' },
  });

  const byId = new Map(categories.map((category) => [category.id, { ...category, children: [] as unknown[] }]));
  const roots: unknown[] = [];

  for (const category of byId.values()) {
    if (category.parentId && byId.has(category.parentId)) {
      byId.get(category.parentId)!.children.push(category);
    } else {
      roots.push(category);
    }
  }
  return roots;
}

export async function getCategory(id: string) {
  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { articles: true, children: true } } },
  });
  if (!category) throw notFound('Catégorie');
  return category;
}

async function resolveSlug(body: CategoryBody): Promise<string> {
  const slug = body.slug ?? slugify(body.name);
  if (!slug) throw conflict('Impossible de générer un slug pour cette catégorie');

  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) throw conflict(`Le slug "${slug}" est déjà utilisé`);
  return slug;
}

export async function createCategory(body: CategoryBody) {
  if (body.parentId) {
    const parent = await prisma.category.findUnique({ where: { id: body.parentId } });
    if (!parent) throw notFound('Catégorie parente');
  }

  return prisma.category.create({
    data: {
      name: body.name,
      slug: await resolveSlug(body),
      description: body.description ?? null,
      parentId: body.parentId ?? null,
      isActive: body.isActive,
    },
  });
}

export async function updateCategory(id: string, body: Partial<CategoryBody>) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw notFound('Catégorie');

  if (body.parentId && body.parentId === id) {
    throw conflict('Une catégorie ne peut pas être sa propre parente');
  }

  if (body.parentId) {
    const parent = await prisma.category.findUnique({ where: { id: body.parentId } });
    if (!parent) throw notFound('Catégorie parente');
  }

  let slug = existing.slug;
  if ((body.slug && body.slug !== existing.slug) || (body.name && body.name !== existing.name)) {
    slug = await resolveSlug({ ...existing, ...body } as CategoryBody);
  }

  return prisma.category.update({
    where: { id },
    data: {
      ...(body.name ? { name: body.name } : {}),
      slug,
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.parentId !== undefined ? { parentId: body.parentId } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
  });
}

/** Désactivation : les catégories référencées ne sont jamais supprimées physiquement. */
export async function deactivateCategory(id: string) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw notFound('Catégorie');
  return prisma.category.update({ where: { id }, data: { isActive: false } });
}
