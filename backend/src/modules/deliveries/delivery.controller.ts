import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validatedBody, validatedParams, validatedQuery } from '../../middleware/validate.js';
import { requireUser } from '../../middleware/auth.js';
import { sendData, created, pageMeta } from '../../utils/http.js';
import type {
  AssignDeliveryInput,
  CompleteDeliveryInput,
  CreateDeliveryInput,
  FailDeliveryInput,
  ListDeliveriesQuery,
} from './delivery.schemas.js';
import * as deliveryService from './delivery.service.js';
import { buildDeliveryPdf } from './delivery.pdf.js';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const query = validatedQuery<ListDeliveriesQuery>(req);
  const { total, items } = await deliveryService.listDeliveries(query, requireUser(req));
  sendData(res, items, pageMeta(total, query));
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const { id } = validatedParams<{ id: string }>(req);
  sendData(res, await deliveryService.getDelivery(id, requireUser(req)));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = validatedBody<CreateDeliveryInput>(req);
  created(res, await deliveryService.createDelivery(input, requireUser(req)));
});

export const assign = asyncHandler(async (req: Request, res: Response) => {
  const { id } = validatedParams<{ id: string }>(req);
  const input = validatedBody<AssignDeliveryInput>(req);
  sendData(res, await deliveryService.assignDelivery(id, input, requireUser(req)));
});

export const unassign = asyncHandler(async (req: Request, res: Response) => {
  const { id } = validatedParams<{ id: string }>(req);
  sendData(res, await deliveryService.unassignDelivery(id, requireUser(req)));
});

export const start = asyncHandler(async (req: Request, res: Response) => {
  const { id } = validatedParams<{ id: string }>(req);
  sendData(res, await deliveryService.startDelivery(id, requireUser(req)));
});

export const complete = asyncHandler(async (req: Request, res: Response) => {
  const { id } = validatedParams<{ id: string }>(req);
  const input = validatedBody<CompleteDeliveryInput>(req);
  sendData(res, await deliveryService.completeDelivery(id, input, requireUser(req)));
});

export const fail = asyncHandler(async (req: Request, res: Response) => {
  const { id } = validatedParams<{ id: string }>(req);
  const input = validatedBody<FailDeliveryInput>(req);
  sendData(res, await deliveryService.failDelivery(id, input, requireUser(req)));
});

export const pdf = asyncHandler(async (req: Request, res: Response) => {
  const { id } = validatedParams<{ id: string }>(req);
  const delivery = await deliveryService.getDelivery(id, requireUser(req));
  const buffer = await buildDeliveryPdf(delivery);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${delivery.deliveryNumber}.pdf"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(buffer);
});
