import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  cancelInvoiceSchema,
  createInvoiceSchema,
  idParamSchema,
  listInvoicesQuerySchema,
} from './invoice.schemas.js';
import * as invoiceController from './invoice.controller.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  authorize('FACTURIER', 'COMMERCIAL'),
  validate({ query: listInvoicesQuerySchema }),
  invoiceController.list,
);
router.get('/:id/pdf', authorize('FACTURIER', 'COMMERCIAL'), validate({ params: idParamSchema }), invoiceController.pdf);
router.get('/:id', authorize('FACTURIER', 'COMMERCIAL'), validate({ params: idParamSchema }), invoiceController.getOne);

router.post('/', authorize('FACTURIER'), validate({ body: createInvoiceSchema }), invoiceController.create);
router.post('/:id/issue', authorize('FACTURIER'), validate({ params: idParamSchema }), invoiceController.issue);
router.post('/:id/pay', authorize('FACTURIER'), validate({ params: idParamSchema }), invoiceController.pay);
router.post(
  '/:id/cancel',
  authorize('FACTURIER'),
  validate({ params: idParamSchema, body: cancelInvoiceSchema }),
  invoiceController.cancel,
);

export default router;
