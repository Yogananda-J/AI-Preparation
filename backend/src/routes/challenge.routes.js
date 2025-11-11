import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

import {
  listChallenges,
  getDailyChallenges,
  getChallengeById,
  runCode,
  saveDraft,
  getDraft,
  submitSolution,
  getSubmissionStatus,
} from '../controllers/challenge.controller.js';

const router = Router();

// All challenges
router.get('/', listChallenges);

// Daily challenges
router.get('/daily', getDailyChallenges);

// Challenge details
router.get('/:id', getChallengeById);

// Run code (simulate execution)
router.post('/run', runCode);

// Submit solution (updates user stats)
router.post('/submit', requireAuth, submitSolution);

// Submission status (polling)
router.get('/submissions/:id', getSubmissionStatus);

// Drafts (per-user)
router.post('/drafts', requireAuth, saveDraft);
router.get('/drafts/:challengeId', requireAuth, getDraft);

export default router;
