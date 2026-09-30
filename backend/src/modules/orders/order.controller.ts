import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validatedBody, validatedParams, validatedQuery } from '../../middleware/validate.js';
import { requireUser } from '../../middleware/auth.js';
import { sendData, created, pageMeta } from '../../utils/http.js';
import { prisma } from '../../lib/prisma.js';
import type {
  CancelOrderInput,
  CreateOrderInput,
  DeliveryInfoInput,
  ListOrdersQuery,
  UpdateOrderInput,
} from './order.schemas.js';
import * as orderService from './order.service.js';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const query = validatedQuery<ListOrdersQuery>(req);
  const user = requireUser(req);
  const { total, items } = await orderService.listOrders(query, user);
  sendData(res, items, pageMeta(total, query));
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const { id } = validatedParams<{ id: string }>(req);
  sendData(res, await orderService.getOrder(id));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = validatedBody<CreateOrderInput>(req);
  const user = requireUser(req);
  const order = await orderService.createOrder(input, user);
  created(res, order);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { id } = validatedParams<{ id: string }>(req);
  const input = validatedBody<UpdateOrderInput>(req);
  const user = requireUser(req);
  sendData(res, await orderService.updateDraftOrder(id, input, user));
});

export const submit = asyncHandler(async (req: Request, res: Response) => {
  const { id } = validatedParams<{ id: string }>(req);
  const user = requireUser(req);
  sendData(res, await orderService.submitOrder(id, user));
});

export const cancel = asyncHandler(async (req: Request, res: Response) => {
  const { id } = validatedParams<{ id: string }>(req);
  const input = validatedBody<CancelOrderInput>(req);
  const user = requireUser(req);
  sendData(res, await orderService.cancelOrder(id, input, user));
});

export const updateDelivery = asyncHandler(async (req: Request, res: Response) => {
  const { id } = validatedParams<{ id: string }>(req);
  const input = validatedBody<DeliveryInfoInput>(req);
  const user = requireUser(req);
  sendData(res, await orderService.updateDeliveryInfo(id, input, user));
});

/** Historique des mouvements de stock liés à la commande. */
export const movements = asyncHandler(async (req: Request, res: Response) => {
  const { id } = validatedParams<{ id: string }>(req);
  const items = await prisma.stockMovement.findMany({
    where: { orderId: id },
    include: {
      article: { select: { id: true, sku: true, name: true, unit: true } },
      user: { select: { id: true, firstName: true, lastName: true, role: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  sendData(res, items);
});
