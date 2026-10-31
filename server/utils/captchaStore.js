import crypto from "node:crypto";

/**
 * Simple CAPTCHA
 * --------------
 * Instead of shipping an image library, the server asks a small arithmetic
 * question and keeps the answer in memory. The answer never reaches the browser,
 * each challenge is single-use, and challenges expire after five minutes.
 *
 * This stops naive scripted login attempts (and pairs well with the per-account
 * lockout) without adding a third-party captcha service.
 */

const TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 5000;
const challenges = new Map();

function cleanup() {
  const now = Date.now();
  for (const [id, entry] of challenges) {
    if (entry.expiresAt <= now) challenges.delete(id);
  }

  // Safety valve: never let the map grow without bound.
  if (challenges.size > MAX_ENTRIES) {
    const oldest = challenges.keys().next().value;
    challenges.delete(oldest);
  }
}

const randomInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

/** Creates a challenge and returns the public part. */
export function createCaptcha() {
  cleanup();

  const useAddition = Math.random() < 0.6;
  let a = randomInt(2, 9);
  let b = randomInt(2, 9);

  // Keep subtraction positive so the answer is never negative.
  if (!useAddition && b > a) [a, b] = [b, a];

  const answer = useAddition ? a + b : a - b;
  const captchaId = crypto.randomUUID();

  challenges.set(captchaId, { answer, expiresAt: Date.now() + TTL_MS });

  return {
    captchaId,
    question: `What is ${a} ${useAddition ? "+" : "−"} ${b}?`,
    expiresIn: TTL_MS / 1000,
  };
}

/**
 * Checks an answer and always consumes the challenge (single use).
 * Returns { ok: true } or { ok: false, reason }.
 */
export function verifyCaptcha(captchaId, answer) {
  cleanup();

  const entry = challenges.get(String(captchaId || ""));
  if (!entry) {
    return { ok: false, reason: "This security check expired. Please try again." };
  }

  challenges.delete(captchaId);

  if (entry.expiresAt <= Date.now()) {
    return { ok: false, reason: "This security check expired. Please try again." };
  }

  if (String(answer ?? "").trim() !== String(entry.answer)) {
    return { ok: false, reason: "Incorrect security check answer. Please try again." };
  }

  return { ok: true };
}
