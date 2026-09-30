import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validatedQuery } from '../../middleware/validate.js';
import { sendData, pageMeta } from '../../utils/http.js';
import type { ListAuditQuery } from './audit.schemas.js';
import * as auditService from './audit.service.js';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const query = validatedQuery<ListAuditQuery>(req);
  const { total, items } = await auditService.listAudit(query);
  sendData(res, items, pageMeta(total, query));
});

export const facets = asyncHandler(async (_req: Request, res: Response) => {
  sendData(res, await auditService.facets());
});
