import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validatedBody, validatedParams, validatedQuery } from '../../middleware/validate.js';
import { requireUser } from '../../middleware/auth.js';
import { sendData, created, pageMeta } from '../../utils/http.js';
import { recordAudit } from '../../utils/audit.js';
import { prisma } from '../../lib/prisma.js';
import type { CustomerBody, ListCustomersQuery } from './customer.schemas.js';
import * as customerService from './customer.service.js';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const query = validatedQuery<ListCustomersQuery>(req);
  const { total, items } = await customerService.listCustomers(query);
  sendData(res, items, pageMeta(total, query));
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const { id } = validatedParams<{ id: string }>(req);
  sendData(res, await customerService.getCustomer(id));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = validatedBody<CustomerBody>(req);
  const actor = requireUser(req);

  const customer = await customerService.createCustomer(input);
  await recordAudit(prisma, {
    userId: actor.id,
    action: 'CREATE',
    entity: 'Customer',
    entityId: customer.id,
    newValue: { name: customer.name, phone: customer.phone },
  });
  created(res, customer);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { id } = validatedParams<{ id: string }>(req);
  const input = validatedBody<Partial<CustomerBody>>(req);
  const actor = requireUser(req);

  const before = await prisma.customer.findUnique({ where: { id } });
  const customer = await customerService.updateCustomer(id, input);
  await recordAudit(prisma, {
    userId: actor.id,
    action: 'UPDATE',
    entity: 'Customer',
    entityId: id,
    oldValue: before ? { name: before.name, phone: before.phone, address: before.address } : null,
    newValue: { name: customer.name, phone: customer.phone, address: customer.address },
  });
  sendData(res, customer);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const { id } = validatedParams<{ id: string }>(req);
  const actor = requireUser(req);

  const customer = await customerService.deactivateCustomer(id);
  await recordAudit(prisma, {
    userId: actor.id,
    action: 'DEACTIVATE',
    entity: 'Customer',
    entityId: id,
    newValue: { isActive: false },
  });
  sendData(res, customer);
});
