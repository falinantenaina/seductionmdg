import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validatedParams, validatedQuery } from '../../middleware/validate.js';
import { requireUser } from '../../middleware/auth.js';
import { sendData, pageMeta } from '../../utils/http.js';
import type { ListNotificationsQuery } from './notification.schemas.js';
import * as notificationService from './notification.service.js';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const query = validatedQuery<ListNotificationsQuery>(req);
  const { total, items } = await notificationService.listNotifications(query, requireUser(req));
  sendData(res, items, pageMeta(total, query));
});

export const count = asyncHandler(async (req: Request, res: Response) => {
  sendData(res, await notificationService.unreadCount(requireUser(req)));
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  const { id } = validatedParams<{ id: string }>(req);
  sendData(res, await notificationService.markRead(id, requireUser(req)));
});

export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  sendData(res, await notificationService.markAllRead(requireUser(req)), undefined, 201);
});
