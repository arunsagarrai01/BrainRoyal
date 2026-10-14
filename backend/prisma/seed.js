import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  categoriesData,
  questionsByCategory,
  achievementsData,
} from './seedData.js';

const prisma = new PrismaClient();

function avatarFor(seed) {
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}`;
}

async function main() {
  console.log('Seeding Quiz Battle Arena...');

  // Clean slate (order matters due to FKs).
  await prisma.userAchievement.deleteMany();
  await prisma.playerAnswer.deleteMany();
  await prisma.battleQuestion.deleteMany();
  await prisma.battle.deleteMany();
  await prisma.answer.deleteMany();
  await prisma.question.deleteMany();
  await prisma.category.deleteMany();
  await prisma.achievement.deleteMany();
  await prisma.user.deleteMany();

  // ---- Achievements ----
  await prisma.achievement.createMany({ data: achievementsData });
  console.log(`  ${achievementsData.length} achievements`);

  // ---- Users ----
  const passwordHash = await bcrypt.hash('Password123', 10);
  const adminHash = await bcrypt.hash('Admin123', 10);

  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      fullName: 'Arena Admin',
      email: 'admin@quizarena.com',
      passwordHash: adminHash,
      role: 'ADMIN',
      avatar: avatarFor('admin'),
      bio: 'Keeper of the Arena.',
      level: 10,
      points: 9800,
    },
  });

  // AI opponent pseudo-user.
  await prisma.user.create({
    data: {
      username: 'quiz_bot',
      fullName: 'Quiz Bot',
      email: 'bot@quizarena.com',
      passwordHash: adminHash,
      role: 'USER',
      avatar: avatarFor('quiz_bot'),
      bio: 'Beep boop. I ask the questions.',
      level: 1,
      points: 0,
    },
  });

  const sampleUsers = [
    { username: 'nova', fullName: 'Nova Reyes', email: 'nova@example.com', points: 7200, level: 8 },
    { username: 'blaze', fullName: 'Blaze Carter', email: 'blaze@example.com', points: 5400, level: 6 },
    { username: 'luna', fullName: 'Luna Park', email: 'luna@example.com', points: 4100, level: 5 },
    { username: 'rex', fullName: 'Rex Monroe', email: 'rex@example.com', points: 3300, level: 4 },
    { username: 'kai', fullName: 'Kai Osei', email: 'kai@example.com', points: 1250, level: 2 },
  ];

  const createdUsers = [];
  for (const u of sampleUsers) {
    const user = await prisma.user.create({
      data: { ...u, passwordHash, avatar: avatarFor(u.username), bio: `${u.fullName} loves a good quiz.` },
    });
    createdUsers.push(user);
  }
  console.log(`  ${sampleUsers.length + 2} users (incl. admin + bot)`);

  // ---- Categories + Questions + Answers ----
  const categoryMap = {};
  for (const cat of categoriesData) {
    const created = await prisma.category.create({ data: cat });
    categoryMap[cat.name] = created;

    const questions = questionsByCategory[cat.name] ?? [];
    for (const item of questions) {
      await prisma.question.create({
        data: {
          categoryId: created.id,
          questionText: item.question,
          difficulty: item.difficulty,
          timeLimit: 15,
          points: 100,
          answers: {
            create: item.options.map((text, idx) => ({
              answerText: text,
              isCorrect: idx === item.correct,
            })),
          },
        },
      });
    }
  }
  const totalQuestions = Object.values(questionsByCategory).reduce((s, arr) => s + arr.length, 0);
  console.log(`  ${categoriesData.length} categories, ${totalQuestions} questions`);

  // ---- Sample completed battles ----
  // Build a few completed AI battles for the first sample user so the
  // dashboard, history and stats pages have real data to render.
  const demoUser = createdUsers[createdUsers.length - 1]; // "kai", 1250 pts
  const bot = await prisma.user.findUnique({ where: { username: 'quiz_bot' } });

  const genCat = categoryMap['General Knowledge'];
  const genQuestions = await prisma.question.findMany({
    where: { categoryId: genCat.id },
    include: { answers: true },
    take: 5,
  });

  for (let b = 0; b < 3; b++) {
    const p1Score = 600 + b * 120;
    const p2Score = 500 + b * 60;
    const battle = await prisma.battle.create({
      data: {
        player1Id: demoUser.id,
        player2Id: bot.id,
        categoryId: genCat.id,
        mode: 'AI',
        difficulty: 'EASY',
        status: 'COMPLETED',
        totalQuestions: genQuestions.length,
        winnerId: demoUser.id,
        player1Score: p1Score,
        player2Score: p2Score,
        startedAt: new Date(Date.now() - (b + 1) * 86400000),
        completedAt: new Date(Date.now() - (b + 1) * 86400000 + 300000),
        battleQuestions: {
          create: genQuestions.map((q, i) => ({ questionId: q.id, questionOrder: i })),
        },
      },
    });

    for (let i = 0; i < genQuestions.length; i++) {
      const q = genQuestions[i];
      const correct = q.answers.find((a) => a.isCorrect);
      const userCorrect = i < 4; // 4/5 correct
      await prisma.playerAnswer.create({
        data: {
          battleId: battle.id,
          questionId: q.id,
          userId: demoUser.id,
          selectedAnswerId: userCorrect ? correct.id : q.answers[(q.answers.indexOf(correct) + 1) % 4].id,
          isCorrect: userCorrect,
          responseTime: 3000 + i * 500,
          pointsEarned: userCorrect ? 120 : 0,
        },
      });
      await prisma.playerAnswer.create({
        data: {
          battleId: battle.id,
          questionId: q.id,
          userId: bot.id,
          selectedAnswerId: correct.id,
          isCorrect: i < 3,
          responseTime: 5000,
          pointsEarned: i < 3 ? 100 : 0,
        },
      });
    }
  }
  console.log('  3 sample battles for user "kai"');

  console.log('\nSeed complete!');
  console.log('Login credentials:');
  console.log('  Admin -> email: admin@quizarena.com | password: Admin123');
  console.log('  User  -> email: kai@example.com     | password: Password123');
  console.log('  (all sample users share the password: Password123)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
