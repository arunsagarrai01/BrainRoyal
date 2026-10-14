import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createBattle,
  getBattleForClient,
  submitAnswer,
  aiAnswer,
  finishBattle,
} from '../services/battleService.js';
import { prisma } from '../config/prisma.js';

export const postBattle = asyncHandler(async (req, res) => {
  const battle = await createBattle({ userId: req.user.id, ...req.body });
  res.status(201).json({ battle });
});

export const getBattle = asyncHandler(async (req, res) => {
  const battle = await getBattleForClient(req.params.id, req.user.id);
  res.json({ battle });
});

export const postAnswer = asyncHandler(async (req, res) => {
  const result = await submitAnswer({
    battleId: req.params.id,
    userId: req.user.id,
    questionId: req.body.questionId,
    selectedAnswerId: req.body.selectedAnswerId ?? null,
    responseTime: req.body.responseTime,
  });

  // In AI mode, let the bot respond to the same question.
  const battle = await prisma.battle.findUnique({ where: { id: req.params.id } });
  let aiResult = null;
  if (battle && battle.mode === 'AI') {
    aiResult = await aiAnswer({ battleId: req.params.id, questionId: req.body.questionId });
  }

  const refreshed = await prisma.battle.findUnique({ where: { id: req.params.id } });

  res.json({
    result,
    aiResult: aiResult ? { pointsEarned: aiResult.pointsEarned, isCorrect: aiResult.isCorrect } : null,
    scores: {
      player1Score: refreshed.player1Score,
      player2Score: refreshed.player2Score,
    },
  });
});

export const postFinish = asyncHandler(async (req, res) => {
  const result = await finishBattle({ battleId: req.params.id, userId: req.user.id });
  res.json({ result });
});

// GET /api/battles — battle history for the current user, with filters.
export const listMyBattles = asyncHandler(async (req, res) => {
  const { result, categoryId } = req.query;
  const userId = req.user.id;

  const battles = await prisma.battle.findMany({
    where: {
      status: 'COMPLETED',
      OR: [{ player1Id: userId }, { player2Id: userId }],
      ...(categoryId ? { categoryId: String(categoryId) } : {}),
    },
    orderBy: { completedAt: 'desc' },
    include: {
      category: { select: { name: true, icon: true, color: true } },
      player1: { select: { id: true, username: true, avatar: true } },
      player2: { select: { id: true, username: true, avatar: true } },
      playerAnswers: true,
    },
  });

  const data = battles
    .map((b) => {
      const opponent = b.player1Id === userId ? b.player2 : b.player1;
      const myScore = b.player1Id === userId ? b.player1Score : b.player2Score;
      const oppScore = b.player1Id === userId ? b.player2Score : b.player1Score;
      const myAnswers = b.playerAnswers.filter((a) => a.userId === userId);
      const correct = myAnswers.filter((a) => a.isCorrect).length;
      const outcome = b.winnerId === userId ? 'WIN' : b.winnerId ? 'LOSS' : 'TIE';
      return {
        id: b.id,
        date: b.completedAt,
        category: b.category,
        opponent,
        myScore,
        oppScore,
        result: outcome,
        accuracy: myAnswers.length ? Math.round((correct / myAnswers.length) * 100) : 0,
        durationMs:
          b.completedAt && b.startedAt ? b.completedAt.getTime() - b.startedAt.getTime() : 0,
      };
    })
    .filter((b) => (result ? b.result === String(result).toUpperCase() : true));

  res.json({ battles: data });
});
