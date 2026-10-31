import {
  applyAccent,
  applyTheme,
  DEFAULT_ACCENT,
  DEFAULT_THEME,
  PREFERS_DARK_QUERY,
  readStoredAccent,
  readStoredTheme,
} from "~/utils/theme";

export type { Theme } from "~/utils/theme";

export function useTheme() {
  const theme = useState<import("~/utils/theme").Theme>(
    "theme",
    () => DEFAULT_THEME,
  );

  const accent = useState<import("~/utils/theme").AccentColor>(
    "accent",
    () => DEFAULT_ACCENT,
  );

  function setAccent(next: import("~/utils/theme").AccentColor) {
    accent.value = next;
    if (import.meta.client) {
      applyAccent(next);
    }
  }

  function setTheme(t: import("~/utils/theme").Theme) {
    theme.value = t;
    if (import.meta.client) {
      applyTheme(t);
    }
  }

  function toggleTheme() {
    setTheme(theme.value === "light" ? "dark" : "light");
  }

  function handleSystemThemeChange() {
    if (theme.value === "system") {
      applyTheme("system");
    }
  }

  if (import.meta.client) {
    onMounted(() => {
      const stored = readStoredTheme();
      theme.value = stored;
      applyTheme(stored);
      setAccent(readStoredAccent());
      window
        .matchMedia?.(PREFERS_DARK_QUERY)
        .addEventListener("change", handleSystemThemeChange);
    });

    onUnmounted(() => {
      window
        .matchMedia?.(PREFERS_DARK_QUERY)
        .removeEventListener("change", handleSystemThemeChange);
    });
  }

  return {
    theme: readonly(theme),
    accent: readonly(accent),
    setTheme,
    setAccent,
    toggleTheme,
  };
}
