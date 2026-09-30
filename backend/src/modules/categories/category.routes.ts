import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  categoryBodySchema,
  idParamSchema,
  listCategoriesQuerySchema,
} from './category.schemas.js';
import * as categoryController from './category.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', validate({ query: listCategoriesQuerySchema }), categoryController.list);
router.get('/:id', validate({ params: idParamSchema }), categoryController.getOne);

// Écriture réservée à l'administration
router.post('/', authorize(), validate({ body: categoryBodySchema }), categoryController.create);
router.put(
  '/:id',
  authorize(),
  validate({ params: idParamSchema, body: categoryBodySchema.partial() }),
  categoryController.update,
);
router.delete('/:id', authorize(), validate({ params: idParamSchema }), categoryController.remove);

export default router;
