import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getRecentActivity, getSubmissionActivity, recomputeUserStats } from '../controllers/profile.controller.js';

const router = Router();

router.get('/activity', requireAuth, getRecentActivity);
router.get('/submissions', requireAuth, getSubmissionActivity);
router.post('/recompute-stats', requireAuth, recomputeUserStats);

export default router;
