export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = Exclude<Theme, "system">;

export const THEME_STORAGE_KEY = "farflung:theme";
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
