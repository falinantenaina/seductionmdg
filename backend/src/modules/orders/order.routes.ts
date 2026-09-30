import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  cancelOrderSchema,
  createOrderSchema,
  deliveryInfoSchema,
  idParamSchema,
  listOrdersQuerySchema,
  updateOrderSchema,
} from './order.schemas.js';
import * as orderController from './order.controller.js';

const router = Router();

router.use(authenticate);

const READ_ROLES = ['COMMERCIAL', 'FACTURIER', 'MAGASINIER', 'DISPATCHER'] as const;

router.get('/', authorize(...READ_ROLES), validate({ query: listOrdersQuerySchema }), orderController.list);

router.get('/:id/movements', authorize(...READ_ROLES), validate({ params: idParamSchema }), orderController.movements);
router.get('/:id', authorize(...READ_ROLES), validate({ params: idParamSchema }), orderController.getOne);

router.post('/', authorize('COMMERCIAL'), validate({ body: createOrderSchema }), orderController.create);
router.put('/:id', authorize('COMMERCIAL'), validate({ params: idParamSchema, body: updateOrderSchema }), orderController.update);
router.post('/:id/submit', authorize('COMMERCIAL'), validate({ params: idParamSchema }), orderController.submit);
/** Lieu de livraison + contacts du destinataire : facturier (depuis la facture) ou commercial. */
router.patch(
  '/:id/delivery',
  authorize('COMMERCIAL', 'FACTURIER'),
  validate({ params: idParamSchema, body: deliveryInfoSchema }),
  orderController.updateDelivery,
);
router.post(
  '/:id/cancel',
  authorize('COMMERCIAL', 'FACTURIER'),
  validate({ params: idParamSchema, body: cancelOrderSchema }),
  orderController.cancel,
);

export default router;
