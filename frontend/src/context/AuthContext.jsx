import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authService } from '../services/index.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session on load using the stored token.
  useEffect(() => {
    const token = localStorage.getItem('qba_token');
    if (!token) {
      setLoading(false);
      return;
    }
    authService
      .me()
      .then((data) => setUser(data.user))
      .catch(() => {
        localStorage.removeItem('qba_token');
      })
      .finally(() => setLoading(false));
  }, []);

  const persist = useCallback((data) => {
    localStorage.setItem('qba_token', data.token);
    setUser(data.user);
  }, []);

  const login = useCallback(
    async (credentials) => {
      const data = await authService.login(credentials);
      persist(data);
      return data.user;
    },
    [persist]
  );

  const register = useCallback(
    async (payload) => {
      const data = await authService.register(payload);
      persist(data);
      return data.user;
    },
    [persist]
  );

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // ignore network errors on logout
    }
    localStorage.removeItem('qba_token');
    setUser(null);
  }, []);

  // Allow pages to refresh the cached user (e.g. after profile edit).
  const updateUser = useCallback((partial) => {
    setUser((prev) => (prev ? { ...prev, ...partial } : prev));
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated: Boolean(user),
    isAdmin: user?.role === 'ADMIN',
    login,
    register,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
