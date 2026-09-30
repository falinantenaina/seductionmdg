import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  assignDeliverySchema,
  completeDeliverySchema,
  createDeliverySchema,
  failDeliverySchema,
  idParamSchema,
  listDeliveriesQuerySchema,
} from './delivery.schemas.js';
import * as deliveryController from './delivery.controller.js';

const router = Router();

/** Lecture : dispatch, magasin (suivi des sorties), facturation et livreurs. */
const READ_ROLES = ['DISPATCHER', 'MAGASINIER', 'FACTURIER', 'LIVREUR'] as const;

router.use(authenticate);

router.get('/', authorize(...READ_ROLES), validate({ query: listDeliveriesQuerySchema }), deliveryController.list);
router.get('/:id', authorize(...READ_ROLES), validate({ params: idParamSchema }), deliveryController.getOne);
router.get('/:id/pdf', authorize(...READ_ROLES), validate({ params: idParamSchema }), deliveryController.pdf);

router.post('/', authorize('DISPATCHER'), validate({ body: createDeliverySchema }), deliveryController.create);
router.post(
  '/:id/assign',
  authorize('DISPATCHER'),
  validate({ params: idParamSchema, body: assignDeliverySchema }),
  deliveryController.assign,
);
router.post('/:id/unassign', authorize('DISPATCHER'), validate({ params: idParamSchema }), deliveryController.unassign);

router.post('/:id/start', authorize('LIVREUR'), validate({ params: idParamSchema }), deliveryController.start);
router.post(
  '/:id/complete',
  authorize('LIVREUR'),
  validate({ params: idParamSchema, body: completeDeliverySchema }),
  deliveryController.complete,
);
router.post(
  '/:id/fail',
  authorize('LIVREUR'),
  validate({ params: idParamSchema, body: failDeliverySchema }),
  deliveryController.fail,
);

export default router;
