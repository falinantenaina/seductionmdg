import { Router } from 'express';
import { authorize, authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createUserSchema, updateUserSchema } from '../auth/auth.schemas.js';
import { listUsersQuerySchema, idParamSchema } from './users.schemas.js';
import * as usersController from './users.controller.js';

const router = Router();

router.use(authenticate, authorize());

router.get('/', validate({ query: listUsersQuerySchema }), usersController.list);
router.get('/:id', validate({ params: idParamSchema }), usersController.getOne);
router.post('/', validate({ body: createUserSchema }), usersController.create);
router.put('/:id', validate({ params: idParamSchema, body: updateUserSchema }), usersController.update);
router.delete('/:id', validate({ params: idParamSchema }), usersController.remove);

export default router;
