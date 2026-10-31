import dotenv from "dotenv";

dotenv.config();

/** Name of the httpOnly cookie that carries the session token. */
export const SESSION_COOKIE = "br_session";

/** "Remember me" keeps the cookie on disk for this long (mirrors the DB expiry). */
export const REMEMBER_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const isProduction = () => process.env.NODE_ENV === "production";

/**
 * Minimal Cookie header parser.
 * We avoid the `cookie-parser` dependency because we only ever read one cookie.
 *
 *   "a=1; br_session=abc" -> { a: "1", br_session: "abc" }
 */
export function parseCookies(cookieHeader = "") {
  return String(cookieHeader)
    .split(";")
    .reduce((cookies, part) => {
      const separator = part.indexOf("=");
      if (separator === -1) return cookies;

      const name = part.slice(0, separator).trim();
      if (!name) return cookies;

      const value = part.slice(separator + 1).trim();
      try {
        cookies[name] = decodeURIComponent(value);
      } catch {
        cookies[name] = value;
      }
      return cookies;
    }, {});
}

/**
 * Writes the session cookie.
 * - httpOnly: JavaScript cannot read it, so an XSS bug cannot steal the session.
 * - sameSite=lax: blocks the cookie on cross-site POSTs (basic CSRF protection).
 * - secure: only over HTTPS, and only in production so localhost still works.
 * - maxAge: only set for "Remember me"; otherwise the browser drops it on close.
 */
export function setSessionCookie(res, token, { remember = false } = {}) {
  const options = {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
  };

  if (remember) {
    options.maxAge = REMEMBER_COOKIE_MAX_AGE_MS;
  }

  res.cookie(SESSION_COOKIE, token, options);
}

/** Expires the cookie (must use the same attributes used when setting it). */
export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
  });
}
