import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { customerBodySchema, idParamSchema, listCustomersQuerySchema } from './customer.schemas.js';
import * as customerController from './customer.controller.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  authorize('COMMERCIAL', 'FACTURIER', 'MAGASINIER', 'DISPATCHER', 'LIVREUR'),
  validate({ query: listCustomersQuerySchema }),
  customerController.list,
);
router.get('/:id', validate({ params: idParamSchema }), customerController.getOne);

router.post(
  '/',
  authorize('COMMERCIAL', 'FACTURIER'),
  validate({ body: customerBodySchema }),
  customerController.create,
);
router.put(
  '/:id',
  authorize('COMMERCIAL', 'FACTURIER'),
  validate({ params: idParamSchema, body: customerBodySchema.partial() }),
  customerController.update,
);
router.delete('/:id', authorize('COMMERCIAL'), validate({ params: idParamSchema }), customerController.remove);

export default router;
