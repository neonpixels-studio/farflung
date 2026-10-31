import { usePreferences } from "~/composables/usePreferences";
import { formatDistanceKm } from "~/utils/formatDistance";
import type { DistanceUnit } from "~/utils/formatDistance";

// What a viewer sees before their preference is known, and what an anonymous
// visitor to a shared trip always sees: the unit trips were stored in.
const FALLBACK_UNIT: DistanceUnit = "km";

/**
 * The signed-in viewer's saved distance unit (Settings > Units & map) plus a
 * formatter for kilometre values. Loads the preference itself when it hasn't
 * been loaded yet, so any page can call this without wiring a fetch.
 */
export function useDistanceUnit() {
  const { isSignedIn } = useClerkAuth();
  const { preferences, hasLoaded, fetchPreferences } = usePreferences();

  const unit = computed<DistanceUnit>(() => {
    if (!isSignedIn.value || !hasLoaded.value) {
      return FALLBACK_UNIT;
    }
    return preferences.value.distanceUnit;
  });

  onMounted(() => {
    watch(
      isSignedIn,
      (signedIn) => {
        if (signedIn && !hasLoaded.value) {
          fetchPreferences();
        }
      },
      { immediate: true },
    );
  });

  function formatDistance(distanceKm: number): string {
    return formatDistanceKm(distanceKm, unit.value);
  }

  return { unit, formatDistance };
}
