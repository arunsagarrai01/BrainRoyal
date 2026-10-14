import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { buildUserStats } from '../services/achievementService.js';

const publicUserSelect = {
  id: true,
  username: true,
  fullName: true,
  email: true,
  avatar: true,
  bio: true,
  role: true,
  level: true,
  points: true,
  createdAt: true,
};

export const getProfile = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: publicUserSelect,
  });

  const stats = await buildUserStats(req.user.id);

  // Determine global rank by points.
  const higher = await prisma.user.count({
    where: { points: { gt: user.points }, username: { not: 'quiz_bot' } },
  });

  // Favourite category by number of battles played.
  const battles = await prisma.battle.findMany({
    where: { OR: [{ player1Id: user.id }, { player2Id: user.id }], status: 'COMPLETED' },
    select: { category: { select: { name: true } } },
  });
  const catCounts = {};
  for (const b of battles) {
    catCounts[b.category.name] = (catCounts[b.category.name] ?? 0) + 1;
  }
  const favouriteCategory =
    Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const totalAnswers = await prisma.playerAnswer.count({ where: { userId: user.id } });

  res.json({
    user,
    stats: {
      ...stats,
      losses: stats.totalBattles - stats.wins,
      winRate: stats.totalBattles ? Math.round((stats.wins / stats.totalBattles) * 100) : 0,
      rank: higher + 1,
      favouriteCategory,
      totalAnswers,
      accuracy: totalAnswers ? Math.round((stats.correctAnswers / totalAnswers) * 100) : 0,
    },
  });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { username, fullName, bio, avatar } = req.body;

  if (username) {
    const taken = await prisma.user.findFirst({
      where: { username, NOT: { id: req.user.id } },
    });
    if (taken) throw ApiError.conflict('That username is already taken');
  }

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      ...(username !== undefined ? { username } : {}),
      ...(fullName !== undefined ? { fullName } : {}),
      ...(bio !== undefined ? { bio } : {}),
      ...(avatar !== undefined ? { avatar } : {}),
    },
    select: publicUserSelect,
  });

  res.json({ user });
});

// Public profile view by username.
export const getPublicProfile = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { username: req.params.username },
    select: { id: true, username: true, fullName: true, avatar: true, bio: true, level: true, points: true },
  });
  if (!user) throw ApiError.notFound('User not found');

  const stats = await buildUserStats(user.id);
  res.json({
    user,
    stats: {
      ...stats,
      losses: stats.totalBattles - stats.wins,
      winRate: stats.totalBattles ? Math.round((stats.wins / stats.totalBattles) * 100) : 0,
    },
  });
});
