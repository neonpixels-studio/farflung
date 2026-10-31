import { describe, it, expect, vi, beforeEach } from "vitest";
import { nextTick, ref } from "vue";
import { mount } from "@vue/test-utils";
import { defineComponent } from "vue";

const isSignedIn = ref(true);
vi.stubGlobal("useClerkAuth", () => ({
  isSignedIn,
  isLoaded: ref(true),
}));

const preferences = ref({ distanceUnit: "mi" });
const hasLoaded = ref(true);
const mockFetchPreferences = vi.fn();
vi.mock("~/composables/usePreferences", () => ({
  usePreferences: () => ({
    preferences,
    hasLoaded,
    fetchPreferences: mockFetchPreferences,
  }),
}));

const { useDistanceUnit } = await import("../useDistanceUnit");

// onMounted needs a component instance, so run the composable inside one.
function mountComposable() {
  let result!: ReturnType<typeof useDistanceUnit>;
  mount(
    defineComponent({
      setup() {
        result = useDistanceUnit();
        return () => null;
      },
    }),
  );
  return result;
}

describe("useDistanceUnit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSignedIn.value = true;
    hasLoaded.value = true;
    preferences.value = { distanceUnit: "mi" };
  });

  it("uses the signed-in viewer's saved unit", () => {
    preferences.value = { distanceUnit: "km" };
    const { unit, formatDistance } = mountComposable();
    expect(unit.value).toBe("km");
    expect(formatDistance(892)).toBe("892 km");
  });

  it("formats in miles when that is the saved unit", () => {
    const { unit, formatDistance } = mountComposable();
    expect(unit.value).toBe("mi");
    expect(formatDistance(892)).toBe("554 mi");
  });

  it("follows a preference change without a reload", async () => {
    const { formatDistance } = mountComposable();
    expect(formatDistance(100)).toBe("62 mi");

    preferences.value = { distanceUnit: "km" };
    await nextTick();

    expect(formatDistance(100)).toBe("100 km");
  });

  it("shows kilometres to an anonymous visitor, whatever the stored default is", () => {
    isSignedIn.value = false;
    const { unit } = mountComposable();
    expect(unit.value).toBe("km");
  });

  it("shows kilometres until the preference has actually loaded", () => {
    hasLoaded.value = false;
    const { unit } = mountComposable();
    expect(unit.value).toBe("km");
  });

  it("loads the preference itself for a signed-in viewer who hasn't loaded it", () => {
    hasLoaded.value = false;
    mountComposable();
    expect(mockFetchPreferences).toHaveBeenCalledTimes(1);
  });

  it("does not refetch an already loaded preference", () => {
    mountComposable();
    expect(mockFetchPreferences).not.toHaveBeenCalled();
  });

  it("does not fetch for an anonymous visitor (the endpoint needs a session)", () => {
    isSignedIn.value = false;
    hasLoaded.value = false;
    mountComposable();
    expect(mockFetchPreferences).not.toHaveBeenCalled();
  });
});
