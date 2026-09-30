import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  adjustStockSchema,
  entryStockSchema,
  listMovementsQuerySchema,
  listStocksQuerySchema,
} from './stock.schemas.js';
import * as stockController from './stock.controller.js';

const router = Router();

router.use(authenticate);

// Lecture du stock : rôles opérationnels (le commercial ne lit que l'état disponible)
router.get(
  '/',
  authorize('COMMERCIAL', 'FACTURIER', 'MAGASINIER', 'DISPATCHER'),
  validate({ query: listStocksQuerySchema }),
  stockController.list,
);

// Historique des mouvements : traçabilité réservée magasin/admin
router.get(
  '/movements',
  authorize('MAGASINIER'),
  validate({ query: listMovementsQuerySchema }),
  stockController.movements,
);

// Écritures : seul le magasinier (et l'admin) modifie le stock
router.post(
  '/entry',
  authorize('MAGASINIER'),
  validate({ body: entryStockSchema }),
  stockController.entry,
);

router.post(
  '/adjustment',
  authorize('MAGASINIER'),
  validate({ body: adjustStockSchema }),
  stockController.adjustment,
);

export default router;
