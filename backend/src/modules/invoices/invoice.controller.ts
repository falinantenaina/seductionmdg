import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validatedBody, validatedParams, validatedQuery } from '../../middleware/validate.js';
import { requireUser } from '../../middleware/auth.js';
import { sendData, created, pageMeta } from '../../utils/http.js';
import type { CancelInvoiceInput, CreateInvoiceInput, ListInvoicesQuery } from './invoice.schemas.js';
import * as invoiceService from './invoice.service.js';
import { buildInvoicePdf } from './invoice.pdf.js';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const query = validatedQuery<ListInvoicesQuery>(req);
  const user = requireUser(req);
  const { total, items } = await invoiceService.listInvoices(query, user);
  sendData(res, items, pageMeta(total, query));
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const { id } = validatedParams<{ id: string }>(req);
  sendData(res, await invoiceService.getInvoice(id, requireUser(req)));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = validatedBody<CreateInvoiceInput>(req);
  created(res, await invoiceService.createInvoice(input, requireUser(req)));
});

export const issue = asyncHandler(async (req: Request, res: Response) => {
  const { id } = validatedParams<{ id: string }>(req);
  sendData(res, await invoiceService.issueInvoice(id, requireUser(req)));
});

export const pay = asyncHandler(async (req: Request, res: Response) => {
  const { id } = validatedParams<{ id: string }>(req);
  sendData(res, await invoiceService.markInvoicePaid(id, requireUser(req)));
});

export const cancel = asyncHandler(async (req: Request, res: Response) => {
  const { id } = validatedParams<{ id: string }>(req);
  const input = validatedBody<CancelInvoiceInput>(req);
  sendData(res, await invoiceService.cancelInvoice(id, input, requireUser(req)));
});

export const pdf = asyncHandler(async (req: Request, res: Response) => {
  const { id } = validatedParams<{ id: string }>(req);
  const invoice = await invoiceService.getInvoice(id, requireUser(req));
  const buffer = await buildInvoicePdf(invoice);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(buffer);
});
