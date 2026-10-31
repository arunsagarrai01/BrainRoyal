import { findSessionByToken } from "../services/sessions.js";
import { SESSION_COOKIE, parseCookies } from "../utils/cookies.js";

/**
 * Authentication & authorization middleware
 * -----------------------------------------
 * Authentication answers "who are you?"  -> requireAuth
 * Authorization answers "may you do this?" -> requireSelf / requireRole
 */

/** Reads a token from `Authorization: Bearer <token>` (API clients, tests). */
function bearerToken(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/**
 * Requires a valid session. Accepts either:
 *   1. the httpOnly session cookie written at login (browsers), or
 *   2. a Bearer token (scripts / non-browser clients).
 *
 * The session is resolved from the database on every request, so logout and
 * "sign out everywhere" take effect immediately.
 */
export async function requireAuth(req, res, next) {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const token = bearerToken(req) || cookies[SESSION_COOKIE];

    if (!token) {
      return res.status(401).json({ message: "Not signed in" });
    }

    const session = await findSessionByToken(token);
    if (!session) {
      return res
        .status(401)
        .json({ message: "Your session expired. Please sign in again." });
    }

    // Attached for controllers and log statements.
    req.user = {
      id: session.user_id,
      username: session.username,
      email: session.email,
      role: session.role || "player",
    };
    req.session = {
      id: session.session_id,
      remember: session.remember,
      expiresAt: session.expires_at,
    };
    req.sessionToken = token;

    return next();
  } catch (err) {
    console.error("[auth] session lookup failed:", err);
    return res.status(500).json({ message: "Could not verify your session" });
  }
}

/**
 * Authorization: a signed-in user may only act on their own records.
 * Example: PATCH /api/users/:id must be the authenticated user's own id.
 */
export function requireSelf(paramName = "id") {
  return (req, res, next) => {
    const targetId = Number(req.params[paramName]);

    if (!Number.isInteger(targetId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    if (req.user?.id !== targetId) {
      return res
        .status(403)
        .json({ message: "You can only access your own account" });
    }

    return next();
  };
}

/**
 * Authorization: role-based access control (RBAC).
 * Every user has `role` ("player" by default); privileged endpoints can require
 * "admin". The role is loaded with the session, so it cannot be spoofed by the
 * client.
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not signed in" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: "You do not have permission to do that" });
    }

    return next();
  };
}

// Backwards-compatible alias used by older imports.
export const authMiddleware = requireAuth;
