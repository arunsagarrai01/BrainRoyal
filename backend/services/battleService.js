import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { computePoints, levelFromPoints } from '../config/scoring.js';
import { evaluateAchievements } from './achievementService.js';

// Pseudo-user id for the AI opponent. Created by the seed.
export const AI_USER_USERNAME = 'quiz_bot';

async function getAiUser() {
  const ai = await prisma.user.findUnique({ where: { username: AI_USER_USERNAME } });
  if (!ai) {
    throw ApiError.badRequest('AI opponent is not configured. Run the database seed.');
  }
  return ai;
}

// Fisher-Yates shuffle.
function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Create a battle and attach randomized questions from the chosen category/difficulty.
 */
export async function createBattle({ userId, categoryId, difficulty, totalQuestions, mode, player2Id }) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw ApiError.notFound('Category not found');

  const pool = await prisma.question.findMany({
    where: { categoryId, difficulty },
    include: { answers: true },
  });

  if (pool.length === 0) {
    throw ApiError.badRequest('No questions available for this category/difficulty');
  }

  const count = Math.min(totalQuestions, pool.length);
  const chosen = shuffle(pool).slice(0, count);

  let resolvedPlayer2 = player2Id ?? null;
  if (mode === 'AI') {
    const ai = await getAiUser();
    resolvedPlayer2 = ai.id;
  }

  const battle = await prisma.battle.create({
    data: {
      player1Id: userId,
      player2Id: resolvedPlayer2,
      categoryId,
      mode,
      difficulty,
      totalQuestions: count,
      status: mode === 'PVP' && !resolvedPlayer2 ? 'WAITING' : 'IN_PROGRESS',
      startedAt: new Date(),
      battleQuestions: {
        create: chosen.map((q, index) => ({
          questionId: q.id,
          questionOrder: index,
        })),
      },
    },
  });

  return getBattleForClient(battle.id, userId);
}

/**
 * Return a battle with its ordered questions (answers stripped of isCorrect
 * so clients cannot cheat). Includes player info.
 */
export async function getBattleForClient(battleId, requestingUserId) {
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: {
      category: true,
      player1: { select: publicUser },
      player2: { select: publicUser },
      winner: { select: publicUser },
      battleQuestions: {
        orderBy: { questionOrder: 'asc' },
        include: { question: { include: { answers: true } } },
      },
    },
  });

  if (!battle) throw ApiError.notFound('Battle not found');

  const isParticipant =
    battle.player1Id === requestingUserId || battle.player2Id === requestingUserId;
  if (!isParticipant) throw ApiError.forbidden('You are not part of this battle');

  const questions = battle.battleQuestions.map((bq) => ({
    order: bq.questionOrder,
    id: bq.question.id,
    questionText: bq.question.questionText,
    difficulty: bq.question.difficulty,
    timeLimit: bq.question.timeLimit,
    points: bq.question.points,
    // Strip is_correct from options sent to the client.
    options: bq.question.answers.map((a) => ({ id: a.id, answerText: a.answerText })),
  }));

  return {
    id: battle.id,
    mode: battle.mode,
    difficulty: battle.difficulty,
    status: battle.status,
    totalQuestions: battle.totalQuestions,
    category: battle.category,
    player1: battle.player1,
    player2: battle.player2,
    winner: battle.winner,
    player1Score: battle.player1Score,
    player2Score: battle.player2Score,
    startedAt: battle.startedAt,
    completedAt: battle.completedAt,
    questions,
  };
}

/**
 * Record a player's answer to a question. Idempotent per (battle, question, user).
 * Returns scoring feedback plus the correct answer id.
 */
export async function submitAnswer({ battleId, userId, questionId, selectedAnswerId, responseTime }) {
  const battle = await prisma.battle.findUnique({ where: { id: battleId } });
  if (!battle) throw ApiError.notFound('Battle not found');
  if (battle.status === 'COMPLETED') throw ApiError.badRequest('Battle already completed');

  const isParticipant = battle.player1Id === userId || battle.player2Id === userId;
  if (!isParticipant) throw ApiError.forbidden('You are not part of this battle');

  // Confirm the question belongs to this battle.
  const bq = await prisma.battleQuestion.findFirst({
    where: { battleId, questionId },
    include: { question: { include: { answers: true } } },
  });
  if (!bq) throw ApiError.badRequest('Question is not part of this battle');

  const correctAnswer = bq.question.answers.find((a) => a.isCorrect);
  const isCorrect = Boolean(selectedAnswerId) && selectedAnswerId === correctAnswer?.id;
  const points = computePoints(isCorrect, responseTime, bq.question.timeLimit, bq.question.points);

  // Upsert so a resubmission does not double-count.
  const existing = await prisma.playerAnswer.findUnique({
    where: { battleId_questionId_userId: { battleId, questionId, userId } },
  });

  if (existing) {
    return {
      alreadyAnswered: true,
      isCorrect: existing.isCorrect,
      pointsEarned: existing.pointsEarned,
      correctAnswerId: correctAnswer?.id ?? null,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.playerAnswer.create({
      data: {
        battleId,
        questionId,
        userId,
        selectedAnswerId: selectedAnswerId ?? null,
        isCorrect,
        responseTime,
        pointsEarned: points,
      },
    });

    // Update running battle score for whichever player this is.
    const field = battle.player1Id === userId ? 'player1Score' : 'player2Score';
    await tx.battle.update({
      where: { id: battleId },
      data: { [field]: { increment: points } },
    });
  });

  return {
    alreadyAnswered: false,
    isCorrect,
    pointsEarned: points,
    correctAnswerId: correctAnswer?.id ?? null,
  };
}

/**
 * Simulate the AI opponent answering a question (used in AI mode).
 * Accuracy scales with (inverse) difficulty.
 */
export async function aiAnswer({ battleId, questionId }) {
  const battle = await prisma.battle.findUnique({ where: { id: battleId } });
  if (!battle || !battle.player2Id) return null;

  const accuracyByDifficulty = { EASY: 0.85, MEDIUM: 0.7, HARD: 0.55 };
  const accuracy = accuracyByDifficulty[battle.difficulty] ?? 0.7;

  const bq = await prisma.battleQuestion.findFirst({
    where: { battleId, questionId },
    include: { question: { include: { answers: true } } },
  });
  if (!bq) return null;

  const correct = bq.question.answers.find((a) => a.isCorrect);
  const willBeCorrect = Math.random() < accuracy;
  const chosen = willBeCorrect
    ? correct
    : bq.question.answers[Math.floor(Math.random() * bq.question.answers.length)];

  // AI "thinking time" between 1.5s and the time limit.
  const responseTime = Math.round(
    1500 + Math.random() * Math.max(1000, bq.question.timeLimit * 1000 - 2000)
  );

  return submitAnswer({
    battleId,
    userId: battle.player2Id,
    questionId,
    selectedAnswerId: chosen?.id ?? null,
    responseTime,
  });
}

/**
 * Finalize a battle: determine the winner, award points/levels, run achievements.
 */
export async function finishBattle({ battleId, userId }) {
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: { playerAnswers: true },
  });
  if (!battle) throw ApiError.notFound('Battle not found');

  const isParticipant = battle.player1Id === userId || battle.player2Id === userId;
  if (!isParticipant) throw ApiError.forbidden('You are not part of this battle');

  if (battle.status === 'COMPLETED') {
    return buildResult(battleId, userId);
  }

  let winnerId = null;
  if (battle.player1Score > battle.player2Score) winnerId = battle.player1Id;
  else if (battle.player2Score > battle.player1Score) winnerId = battle.player2Id;
  // tie -> winnerId stays null

  await prisma.$transaction(async (tx) => {
    await tx.battle.update({
      where: { id: battleId },
      data: { status: 'COMPLETED', winnerId, completedAt: new Date() },
    });

    // Award each human player their battle score as account points, and recompute level.
    const humans = [battle.player1Id, battle.player2Id].filter(Boolean);
    for (const pid of humans) {
      const score = pid === battle.player1Id ? battle.player1Score : battle.player2Score;
      const user = await tx.user.findUnique({ where: { id: pid } });
      if (!user || user.username === 'quiz_bot') continue;
      const newPoints = user.points + score;
      await tx.user.update({
        where: { id: pid },
        data: { points: newPoints, level: levelFromPoints(newPoints) },
      });
    }
  });

  // Evaluate achievements for the requesting human player.
  const unlocked = await evaluateAchievements(userId);
  const result = await buildResult(battleId, userId);
  result.newAchievements = unlocked;
  return result;
}

// Build the detailed result payload for the result screen.
export async function buildResult(battleId, userId) {
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: {
      player1: { select: publicUser },
      player2: { select: publicUser },
      winner: { select: publicUser },
      category: true,
      playerAnswers: true,
    },
  });
  if (!battle) throw ApiError.notFound('Battle not found');

  const myAnswers = battle.playerAnswers.filter((a) => a.userId === userId);
  const correct = myAnswers.filter((a) => a.isCorrect).length;
  const answered = myAnswers.length;
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;
  const avgResponseTime = answered
    ? Math.round(myAnswers.reduce((s, a) => s + a.responseTime, 0) / answered)
    : 0;
  const pointsEarned = myAnswers.reduce((s, a) => s + a.pointsEarned, 0);
  const durationMs =
    battle.completedAt && battle.startedAt
      ? battle.completedAt.getTime() - battle.startedAt.getTime()
      : 0;

  const didWin = battle.winnerId === userId;
  const isTie = battle.status === 'COMPLETED' && !battle.winnerId;

  return {
    battleId: battle.id,
    status: battle.status,
    mode: battle.mode,
    category: battle.category,
    player1: battle.player1,
    player2: battle.player2,
    winner: battle.winner,
    isTie,
    didWin,
    player1Score: battle.player1Score,
    player2Score: battle.player2Score,
    stats: {
      correctAnswers: correct,
      incorrectAnswers: answered - correct,
      totalQuestions: battle.totalQuestions,
      accuracy,
      avgResponseTime,
      pointsEarned,
      durationMs,
    },
    newAchievements: [],
  };
}

export const publicUser = {
  id: true,
  username: true,
  fullName: true,
  avatar: true,
  level: true,
  points: true,
};
