import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validatedQuery } from '../../middleware/validate.js';
import { requireUser } from '../../middleware/auth.js';
import { sendData } from '../../utils/http.js';
import type { DashboardQuery, ReportQuery } from './stats.schemas.js';
import * as statsService from './stats.service.js';

export const dashboard = asyncHandler(async (req: Request, res: Response) => {
  const query = validatedQuery<DashboardQuery>(req);
  sendData(res, await statsService.dashboard(requireUser(req), query.days));
});

export const report = asyncHandler(async (req: Request, res: Response) => {
  const query = validatedQuery<ReportQuery>(req);
  sendData(res, await statsService.report(query));
});
