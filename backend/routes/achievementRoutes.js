import { Router } from 'express';
import { listAchievements } from '../controllers/achievementController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, listAchievements);

export default router;
