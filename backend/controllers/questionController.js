import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// GET /api/questions — admin listing with filters & search.
export const listQuestions = asyncHandler(async (req, res) => {
  const { categoryId, difficulty, search } = req.query;

  const questions = await prisma.question.findMany({
    where: {
      ...(categoryId ? { categoryId: String(categoryId) } : {}),
      ...(difficulty ? { difficulty: String(difficulty) } : {}),
      ...(search ? { questionText: { contains: String(search), mode: 'insensitive' } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: { answers: true, category: { select: { id: true, name: true } } },
  });

  res.json({ questions });
});

export const getQuestion = asyncHandler(async (req, res) => {
  const question = await prisma.question.findUnique({
    where: { id: req.params.id },
    include: { answers: true, category: true },
  });
  if (!question) return res.status(404).json({ error: 'Question not found' });
  res.json({ question });
});

export const createQuestion = asyncHandler(async (req, res) => {
  const { categoryId, questionText, difficulty, timeLimit, points, answers } = req.body;

  const question = await prisma.question.create({
    data: {
      categoryId,
      questionText,
      difficulty,
      timeLimit: timeLimit ?? 15,
      points: points ?? 100,
      answers: { create: answers },
    },
    include: { answers: true },
  });

  res.status(201).json({ question });
});

export const updateQuestion = asyncHandler(async (req, res) => {
  const { categoryId, questionText, difficulty, timeLimit, points, answers } = req.body;

  // Replace answers wholesale to keep the four-option invariant simple.
  const question = await prisma.$transaction(async (tx) => {
    await tx.answer.deleteMany({ where: { questionId: req.params.id } });
    return tx.question.update({
      where: { id: req.params.id },
      data: {
        categoryId,
        questionText,
        difficulty,
        timeLimit: timeLimit ?? 15,
        points: points ?? 100,
        answers: { create: answers },
      },
      include: { answers: true },
    });
  });

  res.json({ question });
});

export const deleteQuestion = asyncHandler(async (req, res) => {
  await prisma.question.delete({ where: { id: req.params.id } });
  res.json({ message: 'Question deleted' });
});
