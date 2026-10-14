// Central, configurable scoring rules. Change these values to tune the game.
export const scoringConfig = {
  // Base points for a correct answer.
  basePoints: 100,
  // Maximum bonus awarded for answering instantly (decays to 0 at the time limit).
  maxSpeedBonus: 50,
  // Points for incorrect or missing answers.
  wrongPoints: 0,
  // Level thresholds: a user levels up every `pointsPerLevel` points.
  pointsPerLevel: 1000,
};

/**
 * Compute points for a single answer.
 * @param {boolean} isCorrect
 * @param {number} responseTimeMs  time taken to answer in milliseconds
 * @param {number} timeLimitSec    question time limit in seconds
 * @param {number} [basePoints]    optional per-question base override
 * @returns {number}
 */
export function computePoints(isCorrect, responseTimeMs, timeLimitSec, basePoints) {
  if (!isCorrect) return scoringConfig.wrongPoints;

  const base = basePoints ?? scoringConfig.basePoints;
  const limitMs = Math.max(1, timeLimitSec * 1000);
  const clamped = Math.min(Math.max(responseTimeMs, 0), limitMs);
  // Linear decay: full bonus at 0ms, no bonus at the time limit.
  const speedFactor = 1 - clamped / limitMs;
  const speedBonus = Math.round(scoringConfig.maxSpeedBonus * speedFactor);

  return base + speedBonus;
}

// Derive level from total points.
export function levelFromPoints(points) {
  return Math.max(1, Math.floor(points / scoringConfig.pointsPerLevel) + 1);
}
