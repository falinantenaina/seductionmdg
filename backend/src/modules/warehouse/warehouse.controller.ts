import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validatedBody, validatedParams, validatedQuery } from '../../middleware/validate.js';
import { requireUser } from '../../middleware/auth.js';
import { sendData, pageMeta } from '../../utils/http.js';
import type { ExitOrderInput, ListExitsQuery } from './warehouse.schemas.js';
import * as warehouseService from './warehouse.service.js';

export const exits = asyncHandler(async (req: Request, res: Response) => {
  const query = validatedQuery<ListExitsQuery>(req);
  const { total, items } = await warehouseService.listExits(query);
  sendData(res, items, pageMeta(total, query));
});

export const exit = asyncHandler(async (req: Request, res: Response) => {
  const { id } = validatedParams<{ id: string }>(req);
  const input = validatedBody<ExitOrderInput>(req);
  sendData(res, await warehouseService.exitOrder(id, input, requireUser(req)));
});
