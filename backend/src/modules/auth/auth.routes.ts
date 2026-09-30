import { Router } from 'express';
import { loginSchema } from './auth.schemas.js';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import * as authController from './auth.controller.js';

const router = Router();

router.post('/login', validate({ body: loginSchema }), authController.login);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.me);

export default router;
