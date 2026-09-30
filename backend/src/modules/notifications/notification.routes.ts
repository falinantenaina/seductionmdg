import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { idParamSchema, listNotificationsQuerySchema } from './notification.schemas.js';
import * as notificationController from './notification.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', validate({ query: listNotificationsQuerySchema }), notificationController.list);
router.get('/count', notificationController.count);
router.post('/read-all', notificationController.markAllRead);
router.post('/:id/read', validate({ params: idParamSchema }), notificationController.markRead);

export default router;
