import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  articleBodySchema,
  idParamSchema,
  listArticlesQuerySchema,
  updateArticleBodySchema,
} from './article.schemas.js';
import * as articleController from './article.controller.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  authorize('COMMERCIAL', 'FACTURIER', 'MAGASINIER', 'DISPATCHER'),
  validate({ query: listArticlesQuerySchema }),
  articleController.list,
);

router.get('/:id', validate({ params: idParamSchema }), articleController.getOne);

// Écriture du catalogue réservée à l'administration
router.post('/', authorize(), validate({ body: articleBodySchema }), articleController.create);
router.put(
  '/:id',
  authorize(),
  validate({ params: idParamSchema, body: updateArticleBodySchema }),
  articleController.update,
);
router.delete('/:id', authorize(), validate({ params: idParamSchema }), articleController.remove);

export default router;
