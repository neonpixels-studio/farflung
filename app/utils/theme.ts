export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "farflung:theme";
export const THEME_ATTR = "data-theme";

export function isValidTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
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
  return "light";
}

export function applyTheme(
  theme: Theme,
  root: HTMLElement = document.documentElement,
) {
  root.setAttribute(THEME_ATTR, theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}
