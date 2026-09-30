import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validatedBody, validatedParams, validatedQuery } from '../../middleware/validate.js';
import { requireUser } from '../../middleware/auth.js';
import { sendData, created, pageMeta } from '../../utils/http.js';
import { recordAudit } from '../../utils/audit.js';
import { prisma } from '../../lib/prisma.js';
import type { ArticleBody, ListArticlesQuery, UpdateArticleBody } from './article.schemas.js';
import * as articleService from './article.service.js';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const query = validatedQuery<ListArticlesQuery>(req);
  const { total, items } = await articleService.listArticles(query);
  sendData(res, items, pageMeta(total, query));
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const { id } = validatedParams<{ id: string }>(req);
  sendData(res, await articleService.getArticle(id));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = validatedBody<ArticleBody>(req);
  const actor = requireUser(req);

  const article = await articleService.createArticle(input, actor.id);
  await recordAudit(prisma, {
    userId: actor.id,
    action: 'CREATE',
    entity: 'Article',
    entityId: article.id,
    newValue: { sku: article.sku, name: article.name, price: article.price.toString() },
  });
  created(res, article);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { id } = validatedParams<{ id: string }>(req);
  const input = validatedBody<UpdateArticleBody>(req);
  const actor = requireUser(req);

  const before = await prisma.article.findUnique({ where: { id } });
  const article = await articleService.updateArticle(id, input);
  await recordAudit(prisma, {
    userId: actor.id,
    action: 'UPDATE',
    entity: 'Article',
    entityId: id,
    oldValue: before
      ? { sku: before.sku, name: before.name, price: before.price.toString(), isActive: before.isActive }
      : null,
    newValue: {
      sku: article.sku,
      name: article.name,
      price: article.price.toString(),
      isActive: article.isActive,
    },
  });
  sendData(res, article);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const { id } = validatedParams<{ id: string }>(req);
  const actor = requireUser(req);

  const article = await articleService.deactivateArticle(id);
  await recordAudit(prisma, {
    userId: actor.id,
    action: 'DEACTIVATE',
    entity: 'Article',
    entityId: id,
    newValue: { isActive: false },
  });
  sendData(res, article);
});
