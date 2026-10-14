import { Router } from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import categoryRoutes from './categoryRoutes.js';
import questionRoutes from './questionRoutes.js';
import battleRoutes from './battleRoutes.js';
import leaderboardRoutes from './leaderboardRoutes.js';
import statisticsRoutes from './statisticsRoutes.js';
import achievementRoutes from './achievementRoutes.js';
import adminRoutes from './adminRoutes.js';

const router = Router();

router.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/categories', categoryRoutes);
router.use('/questions', questionRoutes);
router.use('/battles', battleRoutes);
router.use('/leaderboard', leaderboardRoutes);
router.use('/statistics', statisticsRoutes);
router.use('/achievements', achievementRoutes);
router.use('/admin', adminRoutes);

export default router;
