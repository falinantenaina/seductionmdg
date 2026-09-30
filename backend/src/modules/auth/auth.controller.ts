import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validatedBody } from '../../middleware/validate.js';
import { requireUser } from '../../middleware/auth.js';
import { sendData } from '../../utils/http.js';
import type { LoginInput } from './auth.schemas.js';
import * as authService from './auth.service.js';

export const login = asyncHandler(async (req: Request, res: Response) => {
  const input = validatedBody<LoginInput>(req);
  const result = await authService.login(input);
  sendData(res, result);
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const profile = await authService.getProfile(user.id);
  sendData(res, profile);
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  sendData(res, { loggedOut: true });
});
