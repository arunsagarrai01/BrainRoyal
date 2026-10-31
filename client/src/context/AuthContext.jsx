import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import api from "../api";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

/**
 * Session state for the whole app.
 *
 * The source of truth is the httpOnly cookie managed by the API: on boot we ask
 * /auth/me who we are. `refresh()` is also used after a profile update so the
 * navbar picks up a new username immediately.
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
      setSession(data.session || null);
      return data.user;
    } catch {
      setUser(null);
      setSession(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // The API can invalidate a session at any time (expiry, remote sign-out, ...).
  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      setSession(null);
    };

    window.addEventListener("brainroyale:unauthorized", onUnauthorized);
    return () =>
      window.removeEventListener("brainroyale:unauthorized", onUnauthorized);
  }, []);

  /** Called right after login/registration; the cookie is already set. */
  const login = useCallback((userData, sessionData = null) => {
    setUser(userData);
    setSession(sessionData);
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Already signed out or offline: clearing local state is still correct.
    }
    setUser(null);
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, session, login, logout, refresh, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
};
