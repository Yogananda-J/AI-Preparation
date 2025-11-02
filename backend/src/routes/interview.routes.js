import { Router } from 'express';
import {
  startInterview,
  getInterviewSession,
  getNextQuestion,
  submitAnswer,
  completeInterview,
  getAIFeedback,
} from '../controllers/interview.controller.js';

const router = Router();

router.post('/start', startInterview);
router.get('/:id', getInterviewSession);
router.get('/:id/next-question', getNextQuestion);
router.post('/submit-answer', submitAnswer);
router.post('/:id/complete', completeInterview);
router.get('/:id/feedback', getAIFeedback);

export default router;
