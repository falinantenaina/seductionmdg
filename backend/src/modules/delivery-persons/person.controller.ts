import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validatedBody, validatedParams, validatedQuery } from '../../middleware/validate.js';
import { requireUser } from '../../middleware/auth.js';
import { sendData, created, pageMeta } from '../../utils/http.js';
import type { CreatePersonInput, ListPeopleQuery, UpdatePersonInput } from './person.schemas.js';
import * as personService from './person.service.js';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const query = validatedQuery<ListPeopleQuery>(req);
  const { total, items } = await personService.listPeople(query);
  sendData(res, items, pageMeta(total, query));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = validatedBody<CreatePersonInput>(req);
  created(res, await personService.createPerson(input, requireUser(req)));
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { id } = validatedParams<{ id: string }>(req);
  const input = validatedBody<UpdatePersonInput>(req);
  sendData(res, await personService.updatePerson(id, input, requireUser(req)));
});
