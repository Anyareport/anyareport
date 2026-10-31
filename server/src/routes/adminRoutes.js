import { Router } from 'express';
import { verifyToken } from '../middleware/verifyToken.js';
import { requireActiveUser } from '../middleware/requireActiveUser.js';
import { requireRole } from '../middleware/rbac.js';
import {
  listUsers,
  getUserSummary,
  createOfficial,
  updateUserStatus,
  updateUserRole,
} from '../controllers/adminController.js';
import { requireVerifiedOfficial } from '../middleware/requireVerifiedOfficial.js';

const router = Router();

router.use(verifyToken, requireActiveUser(), requireVerifiedOfficial);
router.use(requireRole('admin'));

router.get('/users/summary', getUserSummary);
router.get('/users', listUsers);
router.post('/users', createOfficial);
router.patch('/users/:id/status', updateUserStatus);
router.patch('/users/:id/role', updateUserRole);

export default router;