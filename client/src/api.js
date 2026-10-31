import axios from "axios";

/**
 * Axios instance for the BrainRoyale API.
 *
 * `withCredentials` makes the browser attach the httpOnly session cookie on every
 * request. The session token is never available to JavaScript, which keeps it out
 * of reach for XSS attacks (unlike a token in localStorage).
 *
 * Override the URL with VITE_API_URL in client/.env.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5001/api",
  withCredentials: true,
});

/**
 * When the server says the session is gone (expired, revoked, password changed on
 * another device) the AuthContext is told so it can show the login page again.
 * Login/registration failures are excluded because a 401 there is simply "wrong
 * email or password".
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || "";
    const isAuthAttempt = url.includes("/auth/login") || url.includes("/auth/register");

    if (status === 401 && !isAuthAttempt) {
      window.dispatchEvent(new Event("brainroyale:unauthorized"));
    }

    return Promise.reject(error);
  }
);

export default api;
