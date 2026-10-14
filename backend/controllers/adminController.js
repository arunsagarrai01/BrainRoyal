import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';

// GET /api/admin/overview — headline numbers for the admin dashboard.
export const getOverview = asyncHandler(async (req, res) => {
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const [totalUsers, totalCategories, totalQuestions, totalBattles, activeUserRows] =
    await Promise.all([
      prisma.user.count({ where: { username: { not: 'quiz_bot' } } }),
      prisma.category.count(),
      prisma.question.count(),
      prisma.battle.count(),
      prisma.playerAnswer.findMany({
        where: { createdAt: { gte: since } },
        select: { userId: true },
        distinct: ['userId'],
      }),
    ]);

  res.json({
    overview: {
      totalUsers,
      activeUsers: activeUserRows.length,
      totalCategories,
      totalQuestions,
      totalBattles,
    },
  });
});

// GET /api/admin/users
export const listUsers = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const users = await prisma.user.findMany({
    where: search
      ? {
          OR: [
            { username: { contains: String(search), mode: 'insensitive' } },
            { email: { contains: String(search), mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      username: true,
      fullName: true,
      email: true,
      role: true,
      level: true,
      points: true,
      createdAt: true,
    },
  });
  res.json({ users });
});

// PUT /api/admin/users/:id — change role.
export const updateUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!['USER', 'ADMIN'].includes(role)) throw ApiError.badRequest('Invalid role');
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { role },
    select: { id: true, username: true, role: true },
  });
  res.json({ user });
});

// DELETE /api/admin/users/:id
export const deleteUser = asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id) throw ApiError.badRequest('You cannot delete your own account');
  await prisma.user.delete({ where: { id: req.params.id } });
  res.json({ message: 'User deleted' });
});

// GET /api/admin/battles
export const listBattles = asyncHandler(async (req, res) => {
  const battles = await prisma.battle.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      category: { select: { name: true } },
      player1: { select: { username: true } },
      player2: { select: { username: true } },
    },
  });
  res.json({ battles });
});
