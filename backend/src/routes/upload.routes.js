import { Router } from 'express';
import { uploadInterviewVideo, uploadOverallInterviewVideo } from '../controllers/upload.controller.js';

const router = Router();

router.post('/interview-video', uploadInterviewVideo);
router.post('/interview-overall-video', uploadOverallInterviewVideo);

export default router;
