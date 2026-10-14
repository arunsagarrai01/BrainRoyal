import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma.js';
import { signToken } from '../utils/jwt.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { isProd } from '../config/env.js';

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
};

function setAuthCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export const register = asyncHandler(async (req, res) => {
  const { username, fullName, email, password } = req.body;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (existing) {
    const field = existing.email === email ? 'email' : 'username';
    throw ApiError.conflict(`An account with that ${field} already exists`);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`;

  const user = await prisma.user.create({
    data: { username, fullName, email, passwordHash, avatar },
    select: publicUserSelect,
  });

  const token = signToken({ sub: user.id, role: user.role });
  setAuthCookie(res, token);
  res.status(201).json({ user, token });
});

export const login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;

  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifier }, { username: identifier }] },
  });
  if (!user) throw ApiError.unauthorized('Invalid credentials');

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw ApiError.unauthorized('Invalid credentials');

  const token = signToken({ sub: user.id, role: user.role });
  setAuthCookie(res, token);

  const { passwordHash, ...safeUser } = user;
  res.json({ user: safeUser, token });
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

// Simple self-service password reset (no email provider wired in this build).
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email, newPassword } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  // Do not reveal whether the email exists.
  if (user) {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  }
  res.json({ message: 'If that email exists, the password has been reset. You can now log in.' });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});
