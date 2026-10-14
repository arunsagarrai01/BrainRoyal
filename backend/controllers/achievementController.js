import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// GET /api/achievements — all achievements with locked/unlocked state for the user.
export const listAchievements = asyncHandler(async (req, res) => {
  const [all, owned] = await Promise.all([
    prisma.achievement.findMany(),
    prisma.userAchievement.findMany({
      where: { userId: req.user.id },
      select: { achievementId: true, unlockedAt: true },
    }),
  ]);

  const ownedMap = new Map(owned.map((o) => [o.achievementId, o.unlockedAt]));

  const achievements = all.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    icon: a.icon,
    unlocked: ownedMap.has(a.id),
    unlockedAt: ownedMap.get(a.id) ?? null,
  }));

  res.json({
    achievements,
    unlockedCount: owned.length,
    totalCount: all.length,
  });
});
