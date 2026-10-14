import { prisma } from '../config/prisma.js';

/**
 * Evaluate a user's stats against all achievements and unlock any newly earned.
 * Returns the list of achievements unlocked during this call (for notifications).
 *
 * Requirement rule shapes (stored on Achievement.requirement as JSON):
 *   { type: 'battles', value: N }        -> total battles played >= N
 *   { type: 'wins', value: N }           -> total wins >= N
 *   { type: 'correct_answers', value: N} -> total correct answers >= N
 *   { type: 'perfect_score' }            -> at least one battle with 100% accuracy
 *   { type: 'speed_demon', value: ms }   -> at least one correct answer under `value` ms
 *   { type: 'win_streak', value: N }     -> current win streak >= N
 */
export async function evaluateAchievements(userId) {
  const [achievements, owned, stats] = await Promise.all([
    prisma.achievement.findMany(),
    prisma.userAchievement.findMany({ where: { userId }, select: { achievementId: true } }),
    buildUserStats(userId),
  ]);

  const ownedIds = new Set(owned.map((o) => o.achievementId));
  const newlyUnlocked = [];

  for (const ach of achievements) {
    if (ownedIds.has(ach.id)) continue;
    if (meetsRequirement(ach.requirement, stats)) {
      try {
        await prisma.userAchievement.create({
          data: { userId, achievementId: ach.id },
        });
        newlyUnlocked.push(ach);
      } catch (err) {
        // Unique constraint race: already unlocked, ignore.
        if (err.code !== 'P2002') throw err;
      }
    }
  }

  return newlyUnlocked;
}

function meetsRequirement(req, stats) {
  switch (req.type) {
    case 'battles':
      return stats.totalBattles >= req.value;
    case 'wins':
      return stats.wins >= req.value;
    case 'correct_answers':
      return stats.correctAnswers >= req.value;
    case 'perfect_score':
      return stats.hasPerfectBattle;
    case 'speed_demon':
      return stats.fastestCorrectMs !== null && stats.fastestCorrectMs <= req.value;
    case 'win_streak':
      return stats.winStreak >= req.value;
    default:
      return false;
  }
}

// Aggregate the numbers achievements rely on.
export async function buildUserStats(userId) {
  const battles = await prisma.battle.findMany({
    where: {
      status: 'COMPLETED',
      OR: [{ player1Id: userId }, { player2Id: userId }],
    },
    orderBy: { completedAt: 'desc' },
    select: {
      id: true,
      player1Id: true,
      player2Id: true,
      winnerId: true,
      completedAt: true,
    },
  });

  const answers = await prisma.playerAnswer.findMany({
    where: { userId },
    select: { isCorrect: true, responseTime: true, battleId: true },
  });

  const correctAnswers = answers.filter((a) => a.isCorrect).length;
  const correctTimes = answers.filter((a) => a.isCorrect).map((a) => a.responseTime);
  const fastestCorrectMs = correctTimes.length ? Math.min(...correctTimes) : null;

  const wins = battles.filter((b) => b.winnerId === userId).length;

  // Perfect battle = all answers in a battle were correct (and there was at least one).
  const byBattle = new Map();
  for (const a of answers) {
    const entry = byBattle.get(a.battleId) ?? { total: 0, correct: 0 };
    entry.total += 1;
    if (a.isCorrect) entry.correct += 1;
    byBattle.set(a.battleId, entry);
  }
  const hasPerfectBattle = [...byBattle.values()].some((e) => e.total > 0 && e.total === e.correct);

  // Current win streak from most recent completed battles.
  let winStreak = 0;
  for (const b of battles) {
    if (b.winnerId === userId) winStreak += 1;
    else break;
  }

  return {
    totalBattles: battles.length,
    wins,
    correctAnswers,
    fastestCorrectMs,
    hasPerfectBattle,
    winStreak,
  };
}
