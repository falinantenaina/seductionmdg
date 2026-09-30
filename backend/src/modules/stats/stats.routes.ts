import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { dashboardQuerySchema, reportQuerySchema } from './stats.schemas.js';
import * as statsController from './stats.controller.js';

const router = Router();

router.use(authenticate);

router.get('/dashboard', validate({ query: dashboardQuerySchema }), statsController.dashboard);
router.get('/report', authorize('ADMIN'), validate({ query: reportQuerySchema }), statsController.report);

export default router;
