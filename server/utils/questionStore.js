import crypto from "node:crypto";

/**
 * In-memory store for active questions.
 * The solution never leaves the server until the player answers, so the
 * score cannot be read from the network response.
 */
const store = new Map();
const TTL_MS = 5 * 60 * 1000;

function cleanup() {
  const now = Date.now();
  for (const [id, entry] of store) {
    if (entry.expiresAt < now) store.delete(id);
  }
}

export function saveQuestion(solution) {
  cleanup();
  const questionId = crypto.randomUUID();
  store.set(questionId, { solution: Number(solution), expiresAt: Date.now() + TTL_MS });
  return questionId;
}

export function takeQuestion(questionId) {
  cleanup();
  const entry = store.get(questionId);
  if (!entry) return null;
  store.delete(questionId);
  return entry;
}
