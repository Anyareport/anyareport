import { Router } from 'express';
import { verifyToken } from '../middleware/verifyToken.js';
import { requireActiveUser } from '../middleware/requireActiveUser.js';
import { requireVerifiedOfficial } from '../middleware/requireVerifiedOfficial.js';
import { requireRole } from '../middleware/rbac.js';
import {
  createManualComplaintForm,
  getManualComplaintForm,
  listManualComplaintForms,
  updateManualComplaintForm,
} from '../controllers/complaintFormController.js';

const router = Router();
router.use(verifyToken, requireActiveUser(), requireVerifiedOfficial, requireRole('secretary'));
router.get('/', listManualComplaintForms);
router.get('/:id', getManualComplaintForm);
router.post('/', createManualComplaintForm);
router.patch('/:id', updateManualComplaintForm);

export default router;
