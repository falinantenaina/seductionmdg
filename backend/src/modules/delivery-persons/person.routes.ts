import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createPersonSchema, idParamSchema, listPeopleQuerySchema, updatePersonSchema } from './person.schemas.js';
import * as personController from './person.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', authorize('DISPATCHER'), validate({ query: listPeopleQuerySchema }), personController.list);
router.post('/', authorize('DISPATCHER'), validate({ body: createPersonSchema }), personController.create);
router.patch(
  '/:id',
  authorize('DISPATCHER'),
  validate({ params: idParamSchema, body: updatePersonSchema }),
  personController.update,
);

export default router;
