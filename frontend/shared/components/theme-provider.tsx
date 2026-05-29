"use client";

import * as React from "react";

export type Theme = "light" | "dark" | "system";
export type ThemePreset = "default" | "azure" | "cobalt" | "graphite" | "lagoon" | "ink" | "ochre" | "sepia";

type ThemeContextValue = {
  theme: Theme;
  preset: ThemePreset;
  setTheme: (theme: Theme) => void;
  setPreset: (preset: ThemePreset) => void;
  resolvedTheme: "light" | "dark";
  systemTheme: "light" | "dark";
  themes: Theme[];
  presets: ThemePreset[];
};

export const THEME_STORAGE_KEY = "theme";
export const THEME_PRESET_STORAGE_KEY = "theme-preset";
const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function resolveSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

function readThemeStorageItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeThemeStorageItem(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Theme changes should still apply even when browser storage is unavailable.
  }
}

export function normalizeTheme(value: string | null | undefined): Theme {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

export function normalizeThemePreset(value: string | null | undefined): ThemePreset {
  return value === "azure" || value === "cobalt" || value === "graphite" || value === "lagoon" || value === "ink" || value === "ochre" || value === "sepia" ? value : "default";
}

function applyTheme(theme: Theme, systemTheme: "light" | "dark", preset: ThemePreset) {
  const resolvedTheme = theme === "system" ? systemTheme : theme;
  const backgroundColor = resolvedTheme === "dark" ? "#191714" : "#f9f5f0";
  const color = resolvedTheme === "dark" ? "#e7e2da" : "#29241f";
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolvedTheme);
  root.dataset.theme = preset;
  root.style.backgroundColor = backgroundColor;
  root.style.color = color;
  root.style.colorScheme = resolvedTheme;
  document.body.style.backgroundColor = backgroundColor;
  document.body.style.color = color;
}

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = React.useState<Theme>("system");
  const [preset, setPresetState] = React.useState<ThemePreset>("default");
  const [systemTheme, setSystemTheme] = React.useState<"light" | "dark">("light");
  const themeRef = React.useRef<Theme>("system");
  const presetRef = React.useRef<ThemePreset>("default");

  React.useEffect(() => {
    const initialSystemTheme = resolveSystemTheme();
    const storedTheme = readThemeStorageItem(THEME_STORAGE_KEY);
    const storedPreset = readThemeStorageItem(THEME_PRESET_STORAGE_KEY);
    const initialTheme = normalizeTheme(storedTheme);
    const initialPreset = normalizeThemePreset(storedPreset);
    themeRef.current = initialTheme;
    presetRef.current = initialPreset;
    setThemeState(initialTheme);
    setPresetState(initialPreset);
    setSystemTheme(initialSystemTheme);
    applyTheme(initialTheme, initialSystemTheme, initialPreset);

    const handleSystemThemeChange = () => {
      const nextSystemTheme = resolveSystemTheme();
      setSystemTheme(nextSystemTheme);
      applyTheme(themeRef.current, nextSystemTheme, presetRef.current);
    };
    try {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      mediaQuery.addEventListener("change", handleSystemThemeChange);
      return () => mediaQuery.removeEventListener("change", handleSystemThemeChange);
    } catch {
      return undefined;
    }
  }, []);

  const setTheme = React.useCallback(
    (nextTheme: Theme) => {
      themeRef.current = nextTheme;
      setThemeState(nextTheme);
      writeThemeStorageItem(THEME_STORAGE_KEY, nextTheme);
      applyTheme(nextTheme, systemTheme, presetRef.current);
    },
    [systemTheme],
  );

  const setPreset = React.useCallback(
    (nextPreset: ThemePreset) => {
      presetRef.current = nextPreset;
      setPresetState(nextPreset);
      writeThemeStorageItem(THEME_PRESET_STORAGE_KEY, nextPreset);
      applyTheme(themeRef.current, systemTheme, nextPreset);
    },
    [systemTheme],
  );

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      preset,
      setTheme,
      setPreset,
      resolvedTheme: theme === "system" ? systemTheme : theme,
      systemTheme,
      themes: ["light", "dark", "system"],
      presets: ["default", "azure", "cobalt", "graphite", "lagoon", "ink", "ochre", "sepia"],
    }),
    [preset, setPreset, setTheme, systemTheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) {
    return {
      theme: "system" as Theme,
      preset: "default" as ThemePreset,
      setTheme: () => undefined,
      setPreset: () => undefined,
      resolvedTheme: "light" as const,
      systemTheme: "light" as const,
      themes: ["light", "dark", "system"] as Theme[],
      presets: ["default", "azure", "cobalt", "graphite", "lagoon", "ink", "ochre", "sepia"] as ThemePreset[],
    };
  }
  return context;
}
