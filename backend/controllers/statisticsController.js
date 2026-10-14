import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { buildUserStats } from '../services/achievementService.js';

// GET /api/statistics — chart-ready stats for the current user.
export const getStatistics = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const battles = await prisma.battle.findMany({
    where: { status: 'COMPLETED', OR: [{ player1Id: userId }, { player2Id: userId }] },
    orderBy: { completedAt: 'asc' },
    include: {
      category: { select: { name: true } },
      playerAnswers: { where: { userId } },
    },
  });

  const base = await buildUserStats(userId);

  // Accuracy over time (per battle).
  const accuracyOverTime = battles.map((b, i) => {
    const total = b.playerAnswers.length;
    const correct = b.playerAnswers.filter((a) => a.isCorrect).length;
    return {
      label: `#${i + 1}`,
      date: b.completedAt,
      accuracy: total ? Math.round((correct / total) * 100) : 0,
      points: b.playerAnswers.reduce((s, a) => s + a.pointsEarned, 0),
    };
  });

  // Wins vs losses.
  const wins = battles.filter((b) => b.winnerId === userId).length;
  const losses = battles.filter((b) => b.winnerId && b.winnerId !== userId).length;
  const ties = battles.filter((b) => !b.winnerId).length;

  // Category performance.
  const categoryMap = new Map();
  for (const b of battles) {
    const name = b.category.name;
    const entry = categoryMap.get(name) ?? { battles: 0, correct: 0, total: 0 };
    entry.battles += 1;
    entry.correct += b.playerAnswers.filter((a) => a.isCorrect).length;
    entry.total += b.playerAnswers.length;
    categoryMap.set(name, entry);
  }
  const categoryPerformance = [...categoryMap.entries()].map(([name, e]) => ({
    category: name,
    battles: e.battles,
    accuracy: e.total ? Math.round((e.correct / e.total) * 100) : 0,
  }));

  // Response time trend.
  const responseTimeTrend = battles.map((b, i) => {
    const times = b.playerAnswers.map((a) => a.responseTime);
    const avg = times.length ? Math.round(times.reduce((s, t) => s + t, 0) / times.length) : 0;
    return { label: `#${i + 1}`, avgMs: avg };
  });

  const totalAnswers = await prisma.playerAnswer.count({ where: { userId } });

  res.json({
    summary: {
      totalBattles: base.totalBattles,
      wins,
      losses,
      ties,
      winStreak: base.winStreak,
      questionsAnswered: totalAnswers,
      correctAnswers: base.correctAnswers,
      accuracy: totalAnswers ? Math.round((base.correctAnswers / totalAnswers) * 100) : 0,
    },
    charts: {
      accuracyOverTime,
      winsVsLosses: [
        { name: 'Wins', value: wins },
        { name: 'Losses', value: losses },
        { name: 'Ties', value: ties },
      ],
      categoryPerformance,
      responseTimeTrend,
    },
  });
});
