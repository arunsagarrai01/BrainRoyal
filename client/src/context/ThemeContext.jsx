import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const ThemeContext = createContext(null);

/** Same key as the bootstrap script in index.html. */
const STORAGE_KEY = "brainroyale:theme";

/** Ask the operating system which theme the user prefers. */
const systemTheme = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

/**
 * Reads the saved choice, falling back to the OS preference.
 * The value is already on <html data-theme="…"> thanks to the inline script in
 * index.html, so the first paint is already correct.
 */
const initialTheme = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // Storage can be blocked (private mode); the OS preference still works.
  }

  return document.documentElement.dataset.theme || systemTheme();
};

/**
 * Theme provider
 * --------------
 * `theme` is either "light" or "dark". The choice is written to
 * <html data-theme> (CSS reads it) and to localStorage (survives reloads).
 */
export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(initialTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;

    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Not fatal: the theme simply will not persist.
    }
  }, [theme]);

  /** Flip between light and dark. */
  const toggleTheme = useCallback(() => {
    setThemeState((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  const setTheme = useCallback((next) => {
    if (next === "dark" || next === "light") setThemeState(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside a ThemeProvider");
  }

  return context;
};
