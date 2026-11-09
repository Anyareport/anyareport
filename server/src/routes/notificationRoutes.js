import { Router } from 'express';
import { verifyToken } from '../middleware/verifyToken.js';
import { requireActiveUser } from '../middleware/requireActiveUser.js';
import { requireRole } from '../middleware/rbac.js';
import {
  exportReports,
  getNotifications,
  markAllRead,
  markGroupRead,
  markRead,
  getAnnouncements,
} from '../controllers/notificationController.js';
import { registerPushToken, removePushToken } from '../controllers/pushController.js';
import { requireVerifiedOfficial } from '../middleware/requireVerifiedOfficial.js';
import upload from '../middleware/upload.js';
import {
  createAnnouncement,
  deleteAnnouncement,
  listSecretaryAnnouncements,
  updateAnnouncement,
} from '../controllers/announcementController.js';

const router = Router();

router.use(verifyToken, requireActiveUser(), requireVerifiedOfficial);

router.post('/push-tokens', registerPushToken);
router.delete('/push-tokens', removePushToken);
router.get('/', getNotifications);
router.get('/announcements/manage', requireRole('secretary'), listSecretaryAnnouncements);
router.get('/announcements', requireRole('resident'), getAnnouncements);
router.patch('/read-all', markAllRead);
router.patch('/reports/:reportId/status-updates/read', markGroupRead);
router.patch('/:id/read', markRead);
router.post('/announcements', requireRole('secretary'), upload.array('images', 3), createAnnouncement);
router.patch('/announcements/:id', requireRole('secretary'), upload.array('images', 3), updateAnnouncement);
router.delete('/announcements/:id', requireRole('secretary'), deleteAnnouncement);

const exportRouter = Router();
exportRouter.use(verifyToken, requireActiveUser(), requireVerifiedOfficial);
exportRouter.use(requireRole('admin', 'captain', 'secretary'));
exportRouter.get('/', exportReports);

export { router as notificationRoutes, exportRouter as exportRoutes };
