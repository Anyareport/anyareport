import { Router } from 'express';
import { verifyToken } from '../middleware/verifyToken.js';
import { requireRole } from '../middleware/rbac.js';
import {
  listUsers,
  createOfficial,
  updateUserStatus,
  updateUserRole,
} from '../controllers/adminController.js';

const router = Router();

router.use(verifyToken);
router.use(requireRole('admin'));

router.get('/users', listUsers);
router.post('/users', createOfficial);
router.patch('/users/:id/status', updateUserStatus);
router.patch('/users/:id/role', updateUserRole);

export default router;
