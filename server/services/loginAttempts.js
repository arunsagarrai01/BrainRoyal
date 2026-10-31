import db from "../config/db.js";

/**
 * Login attempt limitation
 * ------------------------
 * Failed logins are counted per email address and per source IP address.
 *   - 5 wrong passwords for one account  -> that account is locked for 15 minutes.
 *   - 20 wrong passwords from one IP     -> that address is locked for 15 minutes
 *     (a much higher bar, so one office/school network does not lock everyone out).
 *
 * The counters live in the database so a server restart cannot reset the lockout.
 */

export const MAX_ATTEMPTS_PER_ACCOUNT = 5;
export const MAX_ATTEMPTS_PER_IP = 20;
const WINDOW_MINUTES = 15; // attempts older than this are forgotten
const LOCK_MINUTES = 15; // how long a lock lasts

const accountKey = (email) => `email:${String(email).toLowerCase()}`;
const ipKey = (ip) => `ip:${ip}`;

/**
 * Returns { locked, retryAfter } for the email/IP pair.
 * `retryAfter` is the number of seconds until the longer of the two locks ends.
 */
export async function getLockStatus(email, ip) {
  const result = await db.query(
    `SELECT attempt_key, attempts, locked_until,
            GREATEST(
              0,
              CEIL(EXTRACT(EPOCH FROM (locked_until - CURRENT_TIMESTAMP)))
            )::int AS retry_after
       FROM login_attempts
      WHERE attempt_key = $1 OR attempt_key = $2`,
    [accountKey(email), ipKey(ip)]
  );

  const retryAfter = result.rows.reduce(
    (max, row) => Math.max(max, Number(row.retry_after) || 0),
    0
  );

  return { locked: retryAfter > 0, retryAfter };
}

/**
 * Increments one counter and applies the lock when its threshold is reached.
 * A counter whose last attempt is older than the window starts again at 1.
 */
async function bumpCounter(key, threshold) {
  const result = await db.query(
    `INSERT INTO login_attempts (attempt_key, attempts, last_attempt_at)
     VALUES ($1, 1, CURRENT_TIMESTAMP)
     ON CONFLICT (attempt_key) DO UPDATE SET
       attempts = CASE
         WHEN login_attempts.last_attempt_at < CURRENT_TIMESTAMP - ($2 * INTERVAL '1 minute')
           THEN 1
         ELSE login_attempts.attempts + 1
       END,
       last_attempt_at = CURRENT_TIMESTAMP,
       locked_until = CASE
         WHEN login_attempts.last_attempt_at < CURRENT_TIMESTAMP - ($2 * INTERVAL '1 minute')
           THEN NULL
         ELSE login_attempts.locked_until
       END
     RETURNING attempts`,
    [key, WINDOW_MINUTES]
  );

  const attempts = Number(result.rows[0].attempts);

  if (attempts >= threshold) {
    await db.query(
      `UPDATE login_attempts
          SET locked_until = CURRENT_TIMESTAMP + ($2 * INTERVAL '1 minute')
        WHERE attempt_key = $1`,
      [key, LOCK_MINUTES]
    );
    return { attempts, locked: true };
  }

  return { attempts, locked: false };
}

/** Counts a failed sign-in and reports how many tries are left for the account. */
export async function recordFailure(email, ip) {
  const account = await bumpCounter(
    accountKey(email),
    MAX_ATTEMPTS_PER_ACCOUNT
  );
  const address = await bumpCounter(ipKey(ip), MAX_ATTEMPTS_PER_IP);

  return {
    attempts: account.attempts,
    locked: account.locked || address.locked,
    remaining: Math.max(0, MAX_ATTEMPTS_PER_ACCOUNT - account.attempts),
  };
}

/** A successful sign-in wipes both counters for the email/IP pair. */
export async function clearFailures(email, ip) {
  await db.query(
    "DELETE FROM login_attempts WHERE attempt_key = $1 OR attempt_key = $2",
    [accountKey(email), ipKey(ip)]
  );
}
