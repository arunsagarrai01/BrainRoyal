import crypto from "node:crypto";
import db from "../config/db.js";

/**
 * Server-side sessions
 * --------------------
 * A session is an opaque random token stored in an httpOnly cookie. The database
 * only keeps a SHA-256 hash of the token, so:
 *   - the cookie cannot be forged from a database leak;
 *   - sessions can be revoked instantly (logout, password change, "sign out
 *     everywhere") because the server checks the row on every request.
 */

const HOUR_SECONDS = 60 * 60;
const DAY_SECONDS = 24 * HOUR_SECONDS;

/** Normal sign-in: 12 hours of inactivity is plenty for a quiz game. */
export const SESSION_TTL_SECONDS = 12 * HOUR_SECONDS;

/** "Remember me": keep the user signed in for 30 days. */
export const REMEMBER_TTL_SECONDS = 30 * DAY_SECONDS;

const hashToken = (token) =>
  crypto.createHash("sha256").update(String(token)).digest("hex");

/**
 * Creates a session row and returns the raw token for the cookie.
 * The expiry is computed by Postgres so server and DB clocks never disagree.
 */
export async function createSession(user, req, remember = false) {
  const token = crypto.randomBytes(32).toString("hex");
  const ttlSeconds = remember ? REMEMBER_TTL_SECONDS : SESSION_TTL_SECONDS;

  const result = await db.query(
    `INSERT INTO sessions (user_id, token_hash, user_agent, ip, remember, expires_at)
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP + ($6 * INTERVAL '1 second'))
     RETURNING id, created_at, expires_at`,
    [
      user.id,
      hashToken(token),
      String(req.get?.("user-agent") || "").slice(0, 255) || null,
      String(req.ip || "").slice(0, 64) || null,
      Boolean(remember),
      ttlSeconds,
    ]
  );

  return {
    token,
    remember: Boolean(remember),
    ttlSeconds,
    session: result.rows[0],
  };
}

/**
 * Looks up a live session by its raw token and joins the owning user.
 * Expired rows are treated as "not signed in".
 */
export async function findSessionByToken(token) {
  if (!token) return null;

  const result = await db.query(
    `SELECT s.id AS session_id, s.user_id, s.remember, s.created_at,
            s.last_seen_at, s.expires_at, s.user_agent, s.ip,
            u.username, u.email, u.role
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.expires_at > CURRENT_TIMESTAMP`,
    [hashToken(token)]
  );

  if (result.rows.length === 0) return null;

  // Cheap "last activity" tracking: at most one write every five minutes.
  db.query(
    `UPDATE sessions
        SET last_seen_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND last_seen_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes'`,
    [result.rows[0].session_id]
  ).catch(() => {});

  return result.rows[0];
}

/** Deletes one session, but only if it belongs to the given user (authorization). */
export async function revokeSession(sessionId, userId) {
  const result = await db.query(
    "DELETE FROM sessions WHERE id = $1 AND user_id = $2",
    [sessionId, userId]
  );
  return result.rowCount > 0;
}

/** Used after a password change: sign out everywhere except the current device. */
export async function revokeOtherSessions(userId, keepSessionId = 0) {
  const result = await db.query(
    "DELETE FROM sessions WHERE user_id = $1 AND id <> $2",
    [userId, keepSessionId]
  );
  return result.rowCount;
}

/** Sign out of every device, including the current one. */
export async function revokeAllSessions(userId) {
  const result = await db.query("DELETE FROM sessions WHERE user_id = $1", [
    userId,
  ]);
  return result.rowCount;
}

/** Active sessions for the profile page ("where am I signed in?"). */
export async function listSessions(userId, currentSessionId) {
  const result = await db.query(
    `SELECT id, user_agent, ip, remember, created_at, last_seen_at, expires_at
       FROM sessions
      WHERE user_id = $1
        AND expires_at > CURRENT_TIMESTAMP
      ORDER BY last_seen_at DESC NULLS LAST, id DESC`,
    [userId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    userAgent: row.user_agent || "Unknown device",
    ip: row.ip || "unknown",
    remember: row.remember,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    current: Number(row.id) === Number(currentSessionId),
  }));
}

/** Housekeeping: removes expired rows (called on boot and hourly). */
export async function purgeExpiredSessions() {
  const result = await db.query(
    "DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP"
  );
  return result.rowCount;
}
