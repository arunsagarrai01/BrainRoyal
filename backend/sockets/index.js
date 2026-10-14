import { verifyToken } from '../utils/jwt.js';
import { prisma } from '../config/prisma.js';
import { registerBattleHandlers } from './battleHandlers.js';
import { matchmaking } from './matchmaking.js';

/**
 * Attach Socket.IO handlers.
 *
 * This provides the real-time ARCHITECTURE for PvP battles: an authenticated
 * socket layer, a matchmaking queue, battle rooms, and event relays for
 * ready-state, question sync, answer submission, score updates and completion.
 *
 * AI/Practice modes run fully over REST (see battleService). PvP uses these
 * sockets. The two paths are kept separate and clearly labelled.
 */
export function initSockets(io) {
  // Authenticate every socket via JWT handshake.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      const payload = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, username: true, avatar: true, level: true },
      });
      if (!user) return next(new Error('User not found'));
      socket.user = user;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    // Matchmaking: find/queue for a PvP opponent.
    socket.on('matchmaking:join', (payload) => matchmaking.join(io, socket, payload));
    socket.on('matchmaking:leave', () => matchmaking.leave(socket));

    registerBattleHandlers(io, socket);

    socket.on('disconnect', () => {
      matchmaking.leave(socket);
    });
  });
}
