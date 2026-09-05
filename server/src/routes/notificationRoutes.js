import { Router } from 'express';
import { verifyToken } from '../middleware/verifyToken.js';
import { requireRole } from '../middleware/rbac.js';
import {
  exportReports,
  getNotifications,
  markRead,
} from '../controllers/notificationController.js';

const router = Router();

router.use(verifyToken);

router.get('/', getNotifications);
router.patch('/:id/read', markRead);

const exportRouter = Router();
exportRouter.use(verifyToken);
exportRouter.use(requireRole('admin', 'captain', 'secretary', 'kagawad'));
exportRouter.get('/', exportReports);

export { router as notificationRoutes, exportRouter as exportRoutes };
