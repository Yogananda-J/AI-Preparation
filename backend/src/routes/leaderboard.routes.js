import { Router } from 'express';
import { getGlobal, getStats } from '../controllers/leaderboard.controller.js';

const router = Router();

router.get('/global', getGlobal);
router.get('/stats', getStats);

export default router;
