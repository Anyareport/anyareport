import { Router } from 'express';
import { verifyToken } from '../middleware/verifyToken.js';
import { requireActiveUser } from '../middleware/requireActiveUser.js';
import { registerLimiter } from '../middleware/rateLimiters.js';
import { verifyCaptcha } from '../middleware/captcha.js';
import {
  registerProfile,
  getProfile,
  updateProfile,
  syncClaims,
  getUsernameByUid,
} from '../controllers/authController.js';

const router = Router();

router.post(
  '/register',
  verifyToken,
  requireActiveUser({ allowUnregistered: true }),
  registerLimiter,
  verifyCaptcha,
  registerProfile
);
router.get('/profile', verifyToken, getProfile);
router.patch('/profile', verifyToken, requireActiveUser(), updateProfile);
router.post('/sync-claims', verifyToken, syncClaims);
router.get('/find-username', verifyToken, requireActiveUser(), getUsernameByUid);

export default router;
