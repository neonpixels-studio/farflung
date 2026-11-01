import { usePreferences } from "~/composables/usePreferences";

/**
 * Applies the account's saved theme and accent, so they follow a signed-in user
 * to every device. An account that never chose keeps this browser's values.
 */
export function useAppearanceSync() {
  const { isSignedIn } = useClerkAuth();
  const { preferences, hasLoaded, fetchPreferences } = usePreferences();
  const { setTheme, setAccent } = useTheme();

  async function syncFromAccount(signedIn: boolean | undefined): Promise<void> {
    if (!signedIn) {
      return;
    }
    if (!hasLoaded.value) {
      await fetchPreferences();
    }
    const { theme, accentColor } = preferences.value;
    if (theme) {
      setTheme(theme);
    }
    if (accentColor) {
      setAccent(accentColor);
    }
  }

  onMounted(() => {
    watch(isSignedIn, syncFromAccount, { immediate: true });
  });
}
