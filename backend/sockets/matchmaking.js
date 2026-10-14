import { createBattle } from '../services/battleService.js';

/**
 * In-memory matchmaking queue keyed by `${categoryId}:${difficulty}:${totalQuestions}`.
 * For a production, horizontally-scaled deployment this would move to Redis,
 * but the event contract below would stay identical.
 */
class Matchmaking {
  constructor() {
    this.queues = new Map(); // key -> [{ socket, user, payload }]
  }

  key({ categoryId, difficulty, totalQuestions }) {
    return `${categoryId}:${difficulty}:${totalQuestions}`;
  }

  async join(io, socket, payload) {
    const key = this.key(payload);
    const queue = this.queues.get(key) ?? [];

    // Remove any stale entry for this socket.
    const filtered = queue.filter((e) => e.socket.id !== socket.id);

    const opponent = filtered.shift();
    if (opponent) {
      this.queues.set(key, filtered);
      try {
        // Create a PvP battle with both players.
        const battle = await createBattle({
          userId: opponent.user.id,
          categoryId: payload.categoryId,
          difficulty: payload.difficulty,
          totalQuestions: payload.totalQuestions,
          mode: 'PVP',
          player2Id: socket.user.id,
        });

        const room = `battle:${battle.id}`;
        socket.join(room);
        opponent.socket.join(room);
        socket.data.battleId = battle.id;
        opponent.socket.data.battleId = battle.id;

        io.to(room).emit('matchmaking:matched', {
          battleId: battle.id,
          players: [opponent.user, socket.user],
        });
      } catch (err) {
        socket.emit('matchmaking:error', { message: err.message });
        opponent.socket.emit('matchmaking:error', { message: err.message });
      }
    } else {
      filtered.push({ socket, user: socket.user, payload });
      this.queues.set(key, filtered);
      socket.emit('matchmaking:waiting', { message: 'Searching for an opponent...' });
    }
  }

  leave(socket) {
    for (const [key, queue] of this.queues.entries()) {
      const filtered = queue.filter((e) => e.socket.id !== socket.id);
      if (filtered.length) this.queues.set(key, filtered);
      else this.queues.delete(key);
    }
  }
}

export const matchmaking = new Matchmaking();
