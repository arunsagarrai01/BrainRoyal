import bcrypt from "bcryptjs";
import db from "../config/db.js";
import {
  createSession,
  listSessions,
  revokeAllSessions,
  revokeOtherSessions,
  revokeSession,
} from "../services/sessions.js";
import {
  clearFailures,
  getLockStatus,
  recordFailure,
} from "../services/loginAttempts.js";
import { clearSessionCookie, setSessionCookie } from "../utils/cookies.js";
import { createCaptcha, verifyCaptcha } from "../utils/captchaStore.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Password policy for *new* passwords: at least 8 characters, with at least one
 * letter and one number. Existing shorter passwords still work for sign-in, they
 * are simply upgraded the next time the user changes them.
 */
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

const ROLE_DEFAULT = "player";

/** Never send password hashes to the client. */
const publicUser = (row) => ({
  id: row.id,
  username: row.username,
  email: row.email,
  role: row.role || ROLE_DEFAULT,
  created_at: row.created_at,
  last_login_at: row.last_login_at || null,
});

const normaliseEmail = (value) => String(value || "").trim().toLowerCase();
const normaliseUsername = (value) => String(value || "").trim();

/** Shared body for the authenticated user object (profile + dashboard). */
async function loadProfile(userId) {
  const result = await db.query(
    `SELECT u.id, u.username, u.email, u.role, u.created_at, u.last_login_at,
            COALESCE(MAX(s.score), 0)::int AS best_score,
            COUNT(s.id)::int AS games_played
       FROM users u
       LEFT JOIN scores s ON s.user_id = u.id
      WHERE u.id = $1
      GROUP BY u.id, u.username, u.email, u.role, u.created_at, u.last_login_at`,
    [userId]
  );

  return result.rows[0] || null;
}

/* -------------------------------------------------------------------------- */
/* CAPTCHA                                                                    */
/* -------------------------------------------------------------------------- */

/** GET /api/auth/captcha - public, called by the login form. */
export const getCaptcha = (_req, res) => {
  const captcha = createCaptcha();
  return res.status(200).json(captcha);
};

/* -------------------------------------------------------------------------- */
/* Registration                                                               */
/* -------------------------------------------------------------------------- */

export const register = async (req, res) => {
  try {
    const username = normaliseUsername(req.body.username);
    const email = normaliseEmail(req.body.email);
    const password = String(req.body.password || "");

    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (username.length < 3 || username.length > 30) {
      return res
        .status(400)
        .json({ message: "Username must be between 3 and 30 characters" });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ message: "Please enter a valid email" });
    }
    if (!PASSWORD_RE.test(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters and include a letter and a number",
      });
    }

    const existing = await db.query(
      "SELECT id FROM users WHERE LOWER(email) = $1 OR LOWER(username) = $2",
      [email, username.toLowerCase()]
    );

    if (existing.rows.length > 0) {
      return res
        .status(409)
        .json({ message: "An account with that email or username already exists" });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const created = await db.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email, role, created_at, last_login_at`,
      [username, email, password_hash]
    );

    const row = created.rows[0];

    // Registering signs you straight in (session cookie, not "remember me").
    const session = await createSession(row, req, false);
    setSessionCookie(res, session.token, { remember: false });

    return res.status(201).json({
      message: "User registered successfully",
      user: publicUser(row),
      session: { remember: false, expiresIn: session.ttlSeconds },
    });
  } catch (err) {
    console.error("[auth/register]", err);

    // Postgres unique_violation safety net
    if (err.code === "23505") {
      return res
        .status(409)
        .json({ message: "An account with that email or username already exists" });
    }

    return res
      .status(500)
      .json({ message: "Could not create account. Please try again." });
  }
};

/* -------------------------------------------------------------------------- */
/* Login                                                                      */
/* -------------------------------------------------------------------------- */

export const login = async (req, res) => {
  try {
    const email = normaliseEmail(req.body.email);
    const password = String(req.body.password || "");
    const remember = Boolean(req.body.remember);
    const { captchaId, captchaAnswer } = req.body || {};
    const ip = req.ip || "unknown";

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    if (!captchaId || captchaAnswer === undefined || captchaAnswer === "") {
      return res.status(400).json({
        code: "CAPTCHA_REQUIRED",
        message: "Please answer the security check before signing in",
      });
    }

    // 1. CAPTCHA first, so locked-out scripts cannot even burn password guesses.
    const captcha = verifyCaptcha(captchaId, captchaAnswer);
    if (!captcha.ok) {
      return res
        .status(400)
        .json({ code: "CAPTCHA_INVALID", message: captcha.reason });
    }

    // 2. Lockout check (per account across all IPs, plus a looser per-IP limit).
    const lock = await getLockStatus(email, ip);
    if (lock.locked) {
      const minutes = Math.max(1, Math.ceil(lock.retryAfter / 60));
      return res.status(429).json({
        code: "ACCOUNT_LOCKED",
        retryAfter: lock.retryAfter,
        message: `Too many failed sign-in attempts. Try again in ${minutes} minute${
          minutes === 1 ? "" : "s"
        }.`,
      });
    }

    const result = await db.query(
      `SELECT id, username, email, role, password_hash, created_at, last_login_at
         FROM users
        WHERE LOWER(email) = $1`,
      [email]
    );

    // 3. Same generic message for unknown email and wrong password, so the
    //    endpoint cannot be used to discover which accounts exist.
    if (result.rows.length === 0) {
      const failure = await recordFailure(email, ip);
      return res.status(401).json({
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password",
        remainingAttempts: failure.remaining,
      });
    }

    const row = result.rows[0];
    const isMatch = await bcrypt.compare(password, row.password_hash);

    if (!isMatch) {
      const failure = await recordFailure(email, ip);
      return res.status(401).json({
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password",
        remainingAttempts: failure.remaining,
      });
    }

    // 4. Success: reset the counters, remember the login and start a session.
    await clearFailures(email, ip);
    await db.query(
      "UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1",
      [row.id]
    );

    const session = await createSession(row, req, remember);
    setSessionCookie(res, session.token, { remember });

    return res.status(200).json({
      message: "Login successful",
      user: publicUser(row),
      session: { remember, expiresIn: session.ttlSeconds },
    });
  } catch (err) {
    console.error("[auth/login]", err);
    return res
      .status(500)
      .json({ message: "Could not sign in. Please try again." });
  }
};

/* -------------------------------------------------------------------------- */
/* Session lifecycle                                                          */
/* -------------------------------------------------------------------------- */

/** POST /api/auth/logout - ends the current session and clears the cookie. */
export const logout = async (req, res) => {
  try {
    await revokeSession(req.session.id, req.user.id);
  } catch (err) {
    console.error("[auth/logout]", err);
  }

  clearSessionCookie(res);
  return res.status(200).json({ message: "Signed out" });
};

/** POST /api/auth/logout-all - signs out of every device. */
export const logoutAll = async (req, res) => {
  try {
    const removed = await revokeAllSessions(req.user.id);
    clearSessionCookie(res);
    return res
      .status(200)
      .json({ message: `Signed out of ${removed} session${removed === 1 ? "" : "s"}` });
  } catch (err) {
    console.error("[auth/logout-all]", err);
    return res.status(500).json({ message: "Could not sign out everywhere" });
  }
};

/** GET /api/auth/sessions - the devices currently signed in. */
export const getSessions = async (req, res) => {
  try {
    const sessions = await listSessions(req.user.id, req.session.id);
    return res.status(200).json({ sessions });
  } catch (err) {
    console.error("[auth/sessions]", err);
    return res.status(500).json({ message: "Could not load your sessions" });
  }
};

/** DELETE /api/auth/sessions/:id - revoke one device (ownership enforced in SQL). */
export const deleteSession = async (req, res) => {
  try {
    const sessionId = Number(req.params.id);
    if (!Number.isInteger(sessionId)) {
      return res.status(400).json({ message: "Invalid session id" });
    }

    const removed = await revokeSession(sessionId, req.user.id);
    if (!removed) {
      // Same answer for "not yours" and "does not exist": no information leak.
      return res.status(404).json({ message: "Session not found" });
    }

    if (sessionId === req.session.id) {
      clearSessionCookie(res);
    }

    return res.status(200).json({ message: "Session signed out" });
  } catch (err) {
    console.error("[auth/session-delete]", err);
    return res.status(500).json({ message: "Could not sign out that session" });
  }
};

/* -------------------------------------------------------------------------- */
/* Profile                                                                    */
/* -------------------------------------------------------------------------- */

/** GET /api/auth/me - the signed-in user plus their session details. */
export const getMe = async (req, res) => {
  try {
    const user = await loadProfile(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      user,
      session: {
        id: req.session.id,
        remember: req.session.remember,
        expiresAt: req.session.expiresAt,
      },
    });
  } catch (err) {
    console.error("[auth/me]", err);
    return res.status(500).json({ message: "Could not load profile" });
  }
};

/** PATCH /api/auth/me - update the signed-in user's own username/email. */
export const updateProfile = async (req, res) => {
  try {
    const username = normaliseUsername(req.body.username);
    const email = normaliseEmail(req.body.email);

    if (!username || !email) {
      return res
        .status(400)
        .json({ message: "Username and email are required" });
    }
    if (username.length < 3 || username.length > 30) {
      return res
        .status(400)
        .json({ message: "Username must be between 3 and 30 characters" });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ message: "Please enter a valid email" });
    }

    // Authorization: the row being updated always comes from the session id,
    // never from the request body.
    const taken = await db.query(
      `SELECT id FROM users
        WHERE (LOWER(email) = $1 OR LOWER(username) = $2)
          AND id <> $3`,
      [email, username.toLowerCase(), req.user.id]
    );

    if (taken.rows.length > 0) {
      return res
        .status(409)
        .json({ message: "That email or username is already taken" });
    }

    const updated = await db.query(
      `UPDATE users
          SET username = $1, email = $2
        WHERE id = $3
        RETURNING id, username, email, role, created_at, last_login_at`,
      [username, email, req.user.id]
    );

    return res.status(200).json({
      message: "Profile updated",
      user: publicUser(updated.rows[0]),
    });
  } catch (err) {
    console.error("[auth/profile-update]", err);
    if (err.code === "23505") {
      return res
        .status(409)
        .json({ message: "That email or username is already taken" });
    }
    return res.status(500).json({ message: "Could not update your profile" });
  }
};

/** POST /api/auth/change-password - verifies the old password, then rotates it. */
export const changePassword = async (req, res) => {
  try {
    const currentPassword = String(req.body.currentPassword || "");
    const newPassword = String(req.body.newPassword || "");
    const confirmPassword = String(
      req.body.confirmPassword ?? req.body.newPassword ?? ""
    );

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Current and new passwords are required" });
    }
    if (newPassword !== confirmPassword) {
      return res
        .status(400)
        .json({ message: "The new passwords do not match" });
    }
    if (!PASSWORD_RE.test(newPassword)) {
      return res.status(400).json({
        message:
          "New password must be at least 8 characters and include a letter and a number",
      });
    }
    if (currentPassword === newPassword) {
      return res
        .status(400)
        .json({ message: "Choose a password different from the current one" });
    }

    const result = await db.query(
      "SELECT password_hash FROM users WHERE id = $1",
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const matches = await bcrypt.compare(
      currentPassword,
      result.rows[0].password_hash
    );

    if (!matches) {
      return res
        .status(401)
        .json({ message: "Your current password is incorrect" });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    await db.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
      password_hash,
      req.user.id,
    ]);

    // Security: every other device is signed out; this one stays signed in.
    const revoked = await revokeOtherSessions(req.user.id, req.session.id);

    return res.status(200).json({
      message: "Password changed successfully",
      signedOutDevices: revoked,
    });
  } catch (err) {
    console.error("[auth/change-password]", err);
    return res.status(500).json({ message: "Could not change your password" });
  }
};

/* -------------------------------------------------------------------------- */
/* Admin (authorization demo)                                                 */
/* -------------------------------------------------------------------------- */

/** GET /api/auth/admin/users - requires role="admin". */
export const listAllUsers = async (_req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.username, u.email, u.role, u.created_at, u.last_login_at,
              COALESCE(MAX(s.score), 0)::int AS best_score,
              COUNT(s.id)::int AS games_played
         FROM users u
         LEFT JOIN scores s ON s.user_id = u.id
        GROUP BY u.id
        ORDER BY u.id`
    );

    return res.status(200).json({ users: result.rows });
  } catch (err) {
    console.error("[auth/admin/users]", err);
    return res.status(500).json({ message: "Could not load users" });
  }
};
