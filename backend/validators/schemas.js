import { z } from 'zod';

const difficulty = z.enum(['EASY', 'MEDIUM', 'HARD']);
const battleMode = z.enum(['PVP', 'AI', 'PRACTICE']);

export const registerSchema = z
  .object({
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .max(20, 'Username must be at most 20 characters')
      .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers and underscores'),
    fullName: z.string().min(2, 'Full name is required').max(60),
    email: z.string().email('Enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters').max(72),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  identifier: z.string().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters').max(72),
});

export const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(60).optional(),
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/)
    .optional(),
  bio: z.string().max(280).optional(),
  avatar: z.string().max(500).optional(),
});

export const categorySchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().min(2).max(300),
  icon: z.string().min(1).max(50),
  color: z.string().max(20).optional(),
});

export const questionSchema = z.object({
  categoryId: z.string().uuid(),
  questionText: z.string().min(5),
  difficulty,
  timeLimit: z.number().int().min(5).max(60).optional(),
  points: z.number().int().min(10).max(1000).optional(),
  answers: z
    .array(
      z.object({
        answerText: z.string().min(1),
        isCorrect: z.boolean(),
      })
    )
    .length(4, 'Exactly four answer options are required')
    .refine((a) => a.filter((x) => x.isCorrect).length === 1, {
      message: 'Exactly one answer must be marked correct',
    }),
});

export const createBattleSchema = z.object({
  categoryId: z.string().uuid(),
  difficulty,
  totalQuestions: z.number().int().min(3).max(20),
  mode: battleMode,
  player2Id: z.string().uuid().optional(),
});

export const answerSchema = z.object({
  questionId: z.string().uuid(),
  selectedAnswerId: z.string().uuid().nullable().optional(),
  responseTime: z.number().int().min(0).max(120000),
});
