import { Router } from 'express';
import { verifyToken } from '../middleware/verifyToken.js';
import { requireRole } from '../middleware/rbac.js';
import { getAuditFilterOptions, getAuditLogs } from '../controllers/auditController.js';
import { requireVerifiedOfficial } from '../middleware/requireVerifiedOfficial.js';

const router = Router();

router.use(verifyToken, requireVerifiedOfficial);
router.use(requireRole('admin'));
router.get('/filters', getAuditFilterOptions);
router.get('/', getAuditLogs);

export default router;
