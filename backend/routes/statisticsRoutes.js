import { Router } from 'express';
import { getStatistics } from '../controllers/statisticsController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, getStatistics);

export default router;
