/* ThemeProvider — mirrors webapp/src/reusables/design/ThemeProvider.tsx.
 * Persists the chosen theme to AsyncStorage under key "cl_theme". */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getItem, setItem } from "../hooks/storage";
import { Palette, Theme, dark, light } from "./tokens";

const STORAGE_KEY = "cl_theme";

interface ThemeCtx {
  theme: Theme;
  palette: Palette;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    (async () => {
      const stored = await getItem(STORAGE_KEY);
      if (stored === "dark" || stored === "light") setThemeState(stored);
    })();
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    setItem(STORAGE_KEY, t).catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      setItem(STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      theme,
      palette: theme === "dark" ? dark : light,
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme must be used inside <ThemeProvider>");
  return v;
}
