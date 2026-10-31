import { describe, it, expect, vi, beforeEach } from "vitest";
import { defineComponent, ref } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { useAppearanceSync } from "../useAppearanceSync";

const isSignedIn = ref(true);
const preferences = ref<Record<string, unknown>>({});
const hasLoaded = ref(false);
const fetchPreferences = vi.fn().mockResolvedValue(undefined);
const setTheme = vi.fn();
const setAccent = vi.fn();

vi.stubGlobal("useClerkAuth", () => ({ isSignedIn }));
vi.stubGlobal("useTheme", () => ({ setTheme, setAccent }));
vi.mock("~/composables/usePreferences", () => ({
  usePreferences: () => ({ preferences, hasLoaded, fetchPreferences }),
}));

async function runSync() {
  mount(
    defineComponent({
      setup() {
        useAppearanceSync();
        return () => null;
      },
    }),
  );
  await flushPromises();
}

describe("useAppearanceSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSignedIn.value = true;
    hasLoaded.value = false;
    preferences.value = { theme: null, accentColor: null };
  });

  it("applies the account's saved choices", async () => {
    preferences.value = { theme: "dark", accentColor: "rose" };
    await runSync();
    expect(fetchPreferences).toHaveBeenCalled();
    expect(setTheme).toHaveBeenCalledWith("dark");
    expect(setAccent).toHaveBeenCalledWith("rose");
  });

  it("keeps this browser's values when the account never chose", async () => {
    await runSync();
    expect(setTheme).not.toHaveBeenCalled();
    expect(setAccent).not.toHaveBeenCalled();
  });

  it("does nothing when signed out", async () => {
    isSignedIn.value = false;
    await runSync();
    expect(fetchPreferences).not.toHaveBeenCalled();
  });
});
