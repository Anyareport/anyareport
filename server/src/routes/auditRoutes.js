import { Router } from 'express';
import { verifyToken } from '../middleware/verifyToken.js';
import { requireRole } from '../middleware/rbac.js';
import { getAuditLogs } from '../controllers/auditController.js';

const router = Router();

router.use(verifyToken);
router.use(requireRole('admin', 'captain', 'secretary', 'kagawad'));

router.get('/', getAuditLogs);

export default router;
