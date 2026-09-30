import { Router } from 'express';
import { verifyToken } from '../middleware/verifyToken.js';
import { requireRole } from '../middleware/rbac.js';
import { reportSubmitLimiter } from '../middleware/rateLimiters.js';
import upload from '../middleware/upload.js';
import {
  createReport,
  getMyReports,
  getReports,
  getReportById,
  getReportAudit,
  getCaptainInactiveReports,
  flagReport,
  updateReportStatus,
  acknowledgeReport,
  requestBackup,
  joinBackupRequest,
  closeBackupRequest,
  getCategories,
  getAnalytics,
  getHeatmapData,
  classifyReportHandler,
} from '../controllers/reportController.js';

const router = Router();

router.get('/categories', getCategories);

router.use(verifyToken);

router.post('/', reportSubmitLimiter, upload.array('photos', 3), createReport);
router.post('/classify', upload.array('photos', 3), classifyReportHandler);
router.get('/mine', getMyReports);
router.get('/analytics', requireRole('admin', 'captain', 'secretary'), getAnalytics);
router.get('/heatmap', requireRole('admin', 'captain', 'secretary'), getHeatmapData);
router.get('/captain/inactive', requireRole('captain'), getCaptainInactiveReports);
router.get('/', requireRole('admin', 'captain', 'secretary', 'tanod', 'responder'), getReports);
router.get('/:id/audit', requireRole('admin', 'secretary'), getReportAudit);
router.get('/:id', getReportById);
router.post('/:id/flag', requireRole('secretary'), flagReport);
router.patch(
  '/:id/status',
  requireRole('captain', 'secretary', 'tanod', 'responder'),
  updateReportStatus
);
router.post('/:id/backup', requireRole('tanod', 'responder'), requestBackup);
router.post('/:id/backup/join', requireRole('tanod', 'responder'), joinBackupRequest);
router.post('/:id/backup/close', requireRole('tanod', 'responder'), closeBackupRequest);
router.patch('/:id/acknowledge', requireRole('tanod', 'responder'), acknowledgeReport);

export default router;
