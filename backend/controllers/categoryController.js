import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// GET /api/categories — includes aggregate counts for cards.
export const listCategories = asyncHandler(async (req, res) => {
  const { search } = req.query;

  const categories = await prisma.category.findMany({
    where: search
      ? { name: { contains: String(search), mode: 'insensitive' } }
      : undefined,
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { questions: true, battles: true } },
    },
  });

  const data = categories.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    icon: c.icon,
    color: c.color,
    questionCount: c._count.questions,
    battleCount: c._count.battles,
  }));

  res.json({ categories: data });
});

export const getCategory = asyncHandler(async (req, res) => {
  const category = await prisma.category.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { questions: true, battles: true } } },
  });
  if (!category) return res.status(404).json({ error: 'Category not found' });
  res.json({ category });
});

export const createCategory = asyncHandler(async (req, res) => {
  const { name, description, icon, color } = req.body;
  const category = await prisma.category.create({
    data: { name, description, icon, color: color ?? '#6366f1' },
  });
  res.status(201).json({ category });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const category = await prisma.category.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json({ category });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  await prisma.category.delete({ where: { id: req.params.id } });
  res.json({ message: 'Category deleted' });
});
