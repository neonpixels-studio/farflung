import { useApiClient } from "~/composables/useApiClient";
import { extractErrorMessage } from "~/utils/extractErrorMessage";
import type { AccentColor } from "~/utils/accentColors";
import type { Theme } from "~/utils/theme";
import type { DISTANCE_UNIT } from "../../server/db/schema";

export interface UserPreferences {
  distanceUnit: (typeof DISTANCE_UNIT)[keyof typeof DISTANCE_UNIT];
  defaultMapStyle: string | null;
  theme: Theme | null;
  accentColor: AccentColor | null;
  publicProfile: boolean;
  preciseLocation: boolean;
  showOnExplore: boolean;
  displayName: string | null;
  handle: string | null;
  homeBase: string | null;
  bio: string | null;
}

export const PREFERENCES_DEFAULTS: UserPreferences = {
  distanceUnit: "mi",
  defaultMapStyle: null,
  theme: null,
  accentColor: null,
  publicProfile: false,
  preciseLocation: false,
  showOnExplore: true,
  displayName: null,
  handle: null,
  homeBase: null,
  bio: null,
};

export function usePreferences() {
  const { apiFetch } = useApiClient();

  const preferences = useState<UserPreferences>("user-preferences", () => ({
    ...PREFERENCES_DEFAULTS,
  }));

  // Shared (not per-call) so a page that only reads a preference, like the
  // trip distance display, can tell "not fetched yet" from "fetched, and it is
  // the default".
  const hasLoaded = useState<boolean>("user-preferences-loaded", () => false);

  const isLoading = ref(false);
  const loadError = ref<string | null>(null);
  const saveError = ref<string | null>(null);

  async function fetchPreferences(): Promise<void> {
    isLoading.value = true;
    loadError.value = null;

    try {
      const data = await apiFetch<UserPreferences>("/api/preferences");
      preferences.value = data;
      hasLoaded.value = true;
    } catch (error: unknown) {
      const message = extractErrorMessage(error);
      loadError.value = message;
    } finally {
      isLoading.value = false;
    }
  }

  async function savePreferences(
    patch: Partial<UserPreferences>,
  ): Promise<boolean> {
    saveError.value = null;

    try {
      const data = await apiFetch<UserPreferences>("/api/preferences", {
        method: "PATCH",
        body: patch,
      });
      preferences.value = data;
      hasLoaded.value = true;
      return true;
    } catch (error: unknown) {
      saveError.value = extractErrorMessage(error);
      return false;
    }
  }

  return {
    preferences,
    hasLoaded,
    isLoading: readonly(isLoading),
    loadError: readonly(loadError),
    saveError: readonly(saveError),
    fetchPreferences,
    savePreferences,
  };
}
