import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validatedBody, validatedParams, validatedQuery } from '../../middleware/validate.js';
import { requireUser } from '../../middleware/auth.js';
import { sendData, created, pageMeta } from '../../utils/http.js';
import { recordAudit } from '../../utils/audit.js';
import { prisma } from '../../lib/prisma.js';
import type { CategoryBody, ListCategoriesQuery } from './category.schemas.js';
import * as categoryService from './category.service.js';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const query = validatedQuery<ListCategoriesQuery>(req);
  if (query.tree) {
    sendData(res, await categoryService.getCategoryTree());
    return;
  }
  const { total, items } = await categoryService.listCategories(query);
  sendData(res, items, pageMeta(total, query));
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const { id } = validatedParams<{ id: string }>(req);
  sendData(res, await categoryService.getCategory(id));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = validatedBody<CategoryBody>(req);
  const actor = requireUser(req);

  const category = await categoryService.createCategory(input);
  await recordAudit(prisma, {
    userId: actor.id,
    action: 'CREATE',
    entity: 'Category',
    entityId: category.id,
    newValue: { name: category.name, slug: category.slug },
  });
  created(res, category);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { id } = validatedParams<{ id: string }>(req);
  const input = validatedBody<Partial<CategoryBody>>(req);
  const actor = requireUser(req);

  const category = await categoryService.updateCategory(id, input);
  await recordAudit(prisma, {
    userId: actor.id,
    action: 'UPDATE',
    entity: 'Category',
    entityId: id,
    newValue: { name: category.name, slug: category.slug, isActive: category.isActive },
  });
  sendData(res, category);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const { id } = validatedParams<{ id: string }>(req);
  const actor = requireUser(req);

  const category = await categoryService.deactivateCategory(id);
  await recordAudit(prisma, {
    userId: actor.id,
    action: 'DEACTIVATE',
    entity: 'Category',
    entityId: id,
    newValue: { isActive: false },
  });
  sendData(res, category);
});
