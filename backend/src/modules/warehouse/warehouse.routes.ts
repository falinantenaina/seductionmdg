import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { exitOrderSchema, idParamSchema, listExitsQuerySchema } from './warehouse.schemas.js';
import * as warehouseController from './warehouse.controller.js';

const router = Router();

router.use(authenticate);

router.get('/exits', authorize('MAGASINIER', 'DISPATCHER', 'FACTURIER'), validate({ query: listExitsQuerySchema }), warehouseController.exits);

router.post(
  '/orders/:id/exit',
  authorize('MAGASINIER'),
  validate({ params: idParamSchema, body: exitOrderSchema }),
  warehouseController.exit,
);

export default router;
