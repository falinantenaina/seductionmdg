import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { listAuditQuerySchema } from './audit.schemas.js';
import * as auditController from './audit.controller.js';

const router = Router();

router.use(authenticate, authorize('ADMIN'));

router.get('/', validate({ query: listAuditQuerySchema }), auditController.list);
router.get('/facets', auditController.facets);

export default router;
