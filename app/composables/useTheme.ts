import {
  applyTheme,
  DEFAULT_THEME,
  PREFERS_DARK_QUERY,
  readStoredTheme,
} from "~/utils/theme";

export type { Theme } from "~/utils/theme";

export function useTheme() {
  const theme = useState<import("~/utils/theme").Theme>(
    "theme",
    () => DEFAULT_THEME,
  );

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

  return { theme: readonly(theme), setTheme, toggleTheme };
}
