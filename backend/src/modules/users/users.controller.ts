import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validatedBody, validatedParams, validatedQuery } from '../../middleware/validate.js';
import { requireUser } from '../../middleware/auth.js';
import { sendData, created, pageMeta } from '../../utils/http.js';
import { recordAudit } from '../../utils/audit.js';
import { prisma } from '../../lib/prisma.js';
import type { CreateUserInput, UpdateUserInput } from '../auth/auth.schemas.js';
import * as authService from '../auth/auth.service.js';
import type { ListUsersQuery } from './users.schemas.js';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const query = validatedQuery<ListUsersQuery>(req);
  const { total, items } = await authService.listUsers(query);
  sendData(res, items, pageMeta(total, query));
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const { id } = validatedParams<{ id: string }>(req);
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  sendData(res, user);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = validatedBody<CreateUserInput>(req);
  const actor = requireUser(req);

  const user = await authService.createUser(input);
  await recordAudit(prisma, {
    userId: actor.id,
    action: 'CREATE',
    entity: 'User',
    entityId: user.id,
    newValue: { email: user.email, role: user.role },
  });
  created(res, user);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { id } = validatedParams<{ id: string }>(req);
  const input = validatedBody<UpdateUserInput>(req);
  const actor = requireUser(req);

  const before = await prisma.user.findUnique({ where: { id } });
  const user = await authService.updateUser(id, input);
  await recordAudit(prisma, {
    userId: actor.id,
    action: 'UPDATE',
    entity: 'User',
    entityId: id,
    oldValue: before ? { role: before.role, isActive: before.isActive, email: before.email } : null,
    newValue: { role: user.role, isActive: user.isActive, email: user.email },
  });
  sendData(res, user);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const { id } = validatedParams<{ id: string }>(req);
  const actor = requireUser(req);

  const user = await authService.deactivateUser(id, actor.id);
  await recordAudit(prisma, {
    userId: actor.id,
    action: 'DEACTIVATE',
    entity: 'User',
    entityId: id,
    newValue: { isActive: false },
  });
  sendData(res, user);
});
