import { Router } from 'express';
import { verifyToken } from '../middleware/verifyToken.js';
import { registerLimiter } from '../middleware/rateLimiters.js';
import { verifyCaptcha } from '../middleware/captcha.js';
import {
  registerProfile,
  getProfile,
  updateProfile,
  syncClaims,
} from '../controllers/authController.js';

const router = Router();

router.post('/register', verifyToken, registerLimiter, verifyCaptcha, registerProfile);
router.get('/profile', verifyToken, getProfile);
router.patch('/profile', verifyToken, updateProfile);
router.post('/sync-claims', verifyToken, syncClaims);

export default router;
