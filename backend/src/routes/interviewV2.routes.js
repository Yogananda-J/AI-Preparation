import { Router } from 'express';
import {
  createInterviewSession,
  getInterviewSessionV2,
  upsertResponseV2,
  completeInterviewV2,
  getInterviewReportV2,
} from '../controllers/interviewV2.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// All InterviewV2 endpoints require authentication so we can attach
// responses and reports to the logged-in user.
router.post('/', requireAuth, createInterviewSession);
router.get('/:id', requireAuth, getInterviewSessionV2);
router.post('/:id/responses', requireAuth, upsertResponseV2);
router.post('/:id/complete', requireAuth, completeInterviewV2);
router.get('/:id/report', requireAuth, getInterviewReportV2);

export default router;
