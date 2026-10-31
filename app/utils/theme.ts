export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = Exclude<Theme, "system">;

// Not "farflung:theme": that key was auto-written as "light" for every visitor,
// so its value says nothing about what they chose.
export const THEME_STORAGE_KEY = "farflung:theme-preference";
export const THEME_ATTR = "data-theme";
export const DEFAULT_THEME: Theme = "system";
export const PREFERS_DARK_QUERY = "(prefers-color-scheme: dark)";

export function isValidTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

export function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isValidTheme(stored)) {
      return stored;
    }
  } catch {
    // localStorage unavailable (private browsing, SSR)
  }
  return DEFAULT_THEME;
}

export function systemPrefersDark(): boolean {
  return window.matchMedia?.(PREFERS_DARK_QUERY).matches ?? false;
}

export function resolveTheme(
  theme: Theme,
  prefersDark: boolean = systemPrefersDark(),
): ResolvedTheme {
  if (theme !== "system") {
    return theme;
  }
  return prefersDark ? "dark" : "light";
}

export function applyTheme(
  theme: Theme,
  root: HTMLElement = document.documentElement,
) {
  root.setAttribute(THEME_ATTR, resolveTheme(theme));
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

export const ACCENT_COLORS = [
  "violet",
  "indigo",
  "blue",
  "emerald",
  "amber",
  "orange",
  "rose",
  "graphite",
] as const;

export type AccentColor = (typeof ACCENT_COLORS)[number];

export const ACCENT_STORAGE_KEY = "farflung:accent";
export const ACCENT_ATTR = "data-accent";
export const DEFAULT_ACCENT: AccentColor = "violet";

export function isValidAccent(value: unknown): value is AccentColor {
  return ACCENT_COLORS.includes(value as AccentColor);
}

export function readStoredAccent(): AccentColor {
  try {
    const stored = localStorage.getItem(ACCENT_STORAGE_KEY);
    if (isValidAccent(stored)) {
      return stored;
    }
  } catch {
    // localStorage unavailable (private browsing, SSR)
  }
  return DEFAULT_ACCENT;
}

export function applyAccent(
  accent: AccentColor,
  root: HTMLElement = document.documentElement,
) {
  root.setAttribute(ACCENT_ATTR, accent);
  try {
    localStorage.setItem(ACCENT_STORAGE_KEY, accent);
  } catch {
    // ignore
  }
}
