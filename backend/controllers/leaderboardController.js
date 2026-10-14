import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { buildUserStats } from '../services/achievementService.js';

// GET /api/leaderboard?scope=global|weekly|monthly|category&categoryId=...
export const getLeaderboard = asyncHandler(async (req, res) => {
  const { scope = 'global', categoryId } = req.query;

  // Weekly / monthly / category rankings are computed from battle points in a window.
  if (scope === 'weekly' || scope === 'monthly' || scope === 'category') {
    const since = new Date();
    if (scope === 'weekly') since.setDate(since.getDate() - 7);
    if (scope === 'monthly') since.setMonth(since.getMonth() - 1);

    const answers = await prisma.playerAnswer.findMany({
      where: {
        ...(scope !== 'category' ? { createdAt: { gte: since } } : {}),
        ...(scope === 'category' && categoryId
          ? { battle: { categoryId: String(categoryId) } }
          : {}),
        user: { username: { not: 'quiz_bot' } },
      },
      select: { userId: true, pointsEarned: true },
    });

    const totals = new Map();
    for (const a of answers) {
      totals.set(a.userId, (totals.get(a.userId) ?? 0) + a.pointsEarned);
    }

    const topIds = [...totals.entries()]
      .sort((x, y) => y[1] - x[1])
      .slice(0, 50);

    const users = await prisma.user.findMany({
      where: { id: { in: topIds.map(([id]) => id) } },
      select: { id: true, username: true, avatar: true, level: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const entries = topIds.map(([id, pts], index) => ({
      rank: index + 1,
      user: userMap.get(id),
      points: pts,
    }));

    return res.json({ scope, entries });
  }

  // Global: order by lifetime points.
  const users = await prisma.user.findMany({
    where: { username: { not: 'quiz_bot' } },
    orderBy: { points: 'desc' },
    take: 50,
    select: { id: true, username: true, avatar: true, level: true, points: true },
  });

  const entries = await Promise.all(
    users.map(async (u, index) => {
      const stats = await buildUserStats(u.id);
      return {
        rank: index + 1,
        user: u,
        points: u.points,
        wins: stats.wins,
        winRate: stats.totalBattles ? Math.round((stats.wins / stats.totalBattles) * 100) : 0,
      };
    })
  );

  res.json({ scope: 'global', entries });
});
