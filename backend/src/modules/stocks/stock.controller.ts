import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validatedBody, validatedQuery } from '../../middleware/validate.js';
import { requireUser } from '../../middleware/auth.js';
import { sendData, pageMeta } from '../../utils/http.js';
import { recordAudit } from '../../utils/audit.js';
import { prisma } from '../../lib/prisma.js';
import type {
  AdjustStockInput,
  EntryStockInput,
  ListMovementsQuery,
  ListStocksQuery,
} from './stock.schemas.js';
import * as stockService from './stock.service.js';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const query = validatedQuery<ListStocksQuery>(req);
  const { total, items } = await stockService.listStocks(query);
  sendData(res, items, pageMeta(total, query));
});

export const movements = asyncHandler(async (req: Request, res: Response) => {
  const query = validatedQuery<ListMovementsQuery>(req);
  const { total, items } = await stockService.listMovements(query);
  sendData(res, items, pageMeta(total, query));
});

export const entry = asyncHandler(async (req: Request, res: Response) => {
  const input = validatedBody<EntryStockInput>(req);
  const actor = requireUser(req);

  const article = await stockService.entryStock({ ...input, userId: actor.id });
  await recordAudit(prisma, {
    userId: actor.id,
    action: 'STOCK_ENTRY',
    entity: 'Article',
    entityId: article.id,
    newValue: { quantity: input.quantity, stockPhysical: article.stockPhysical },
  });
  sendData(res, article);
});

export const adjustment = asyncHandler(async (req: Request, res: Response) => {
  const input = validatedBody<AdjustStockInput>(req);
  const actor = requireUser(req);

  const before = await prisma.article.findUnique({
    where: { id: input.articleId },
    select: { stockPhysical: true, stockReserved: true },
  });

  const article = await stockService.adjustStock({ ...input, userId: actor.id });
  await recordAudit(prisma, {
    userId: actor.id,
    action: 'STOCK_ADJUSTMENT',
    entity: 'Article',
    entityId: article.id,
    oldValue: before ? { stockPhysical: before.stockPhysical } : null,
    newValue: { stockPhysical: article.stockPhysical, comment: input.comment ?? null },
  });
  sendData(res, article);
});
