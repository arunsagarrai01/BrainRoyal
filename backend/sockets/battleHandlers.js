import { submitAnswer, finishBattle, getBattleForClient } from '../services/battleService.js';
import { prisma } from '../config/prisma.js';

/**
 * Real-time battle room events for PvP mode. The room is `battle:<id>`.
 * Clients relay their state through the server so both players stay in sync.
 */
export function registerBattleHandlers(io, socket) {
  // Join an existing battle room (e.g. after matchmaking or reconnect).
  socket.on('battle:join', async ({ battleId }) => {
    try {
      const battle = await prisma.battle.findUnique({ where: { id: battleId } });
      if (!battle) return socket.emit('battle:error', { message: 'Battle not found' });
      const isParticipant =
        battle.player1Id === socket.user.id || battle.player2Id === socket.user.id;
      if (!isParticipant) return socket.emit('battle:error', { message: 'Not a participant' });

      socket.join(`battle:${battleId}`);
      socket.data.battleId = battleId;
      socket.to(`battle:${battleId}`).emit('battle:playerJoined', { user: socket.user });
    } catch (err) {
      socket.emit('battle:error', { message: err.message });
    }
  });

  // Broadcast ready status.
  socket.on('battle:ready', ({ battleId }) => {
    io.to(`battle:${battleId}`).emit('battle:playerReady', { userId: socket.user.id });
  });

  // Either client can trigger the synchronized start countdown.
  socket.on('battle:start', ({ battleId }) => {
    io.to(`battle:${battleId}`).emit('battle:starting', { countdown: 3 });
  });

  // Relay the current question index so both players advance together.
  socket.on('battle:nextQuestion', ({ battleId, index }) => {
    io.to(`battle:${battleId}`).emit('battle:question', { index });
  });

  // Submit an answer, persist it, then broadcast updated scores.
  socket.on('battle:answer', async ({ battleId, questionId, selectedAnswerId, responseTime }) => {
    try {
      const result = await submitAnswer({
        battleId,
        userId: socket.user.id,
        questionId,
        selectedAnswerId: selectedAnswerId ?? null,
        responseTime,
      });

      const battle = await prisma.battle.findUnique({ where: { id: battleId } });
      io.to(`battle:${battleId}`).emit('battle:scoreUpdate', {
        userId: socket.user.id,
        isCorrect: result.isCorrect,
        pointsEarned: result.pointsEarned,
        player1Score: battle.player1Score,
        player2Score: battle.player2Score,
      });
    } catch (err) {
      socket.emit('battle:error', { message: err.message });
    }
  });

  // Finish the battle and broadcast the result to the room.
  socket.on('battle:finish', async ({ battleId }) => {
    try {
      const result = await finishBattle({ battleId, userId: socket.user.id });
      io.to(`battle:${battleId}`).emit('battle:completed', { result });
    } catch (err) {
      socket.emit('battle:error', { message: err.message });
    }
  });
}
