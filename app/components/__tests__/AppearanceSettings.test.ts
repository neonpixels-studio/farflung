import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { mount } from "@vue/test-utils";
import AppearanceSettings from "../AppearanceSettings.vue";
import { ACCENT_COLORS } from "~/utils/accentColors";

const theme = ref("system");
const accent = ref("violet");
const setTheme = vi.fn();
const setAccent = vi.fn();
const savePreferences = vi.fn();

vi.stubGlobal("useTheme", () => ({ theme, accent, setTheme, setAccent }));
vi.mock("~/composables/usePreferences", () => ({
  usePreferences: () => ({ saveError: ref(null), savePreferences }),
}));

function mountSettings() {
  return mount(AppearanceSettings, { global: { stubs: { AppIcon: true } } });
}

describe("AppearanceSettings", () => {
  beforeEach(() => {
    theme.value = "system";
    accent.value = "violet";
    vi.clearAllMocks();
  });

  it("offers three themes and every accent", () => {
    const wrapper = mountSettings();
    expect(wrapper.findAll(".theme-card")).toHaveLength(3);
    expect(wrapper.findAll(".swatch")).toHaveLength(ACCENT_COLORS.length);
  });

  it("marks the current choices", () => {
    accent.value = "rose";
    const wrapper = mountSettings();
    expect(wrapper.find(".theme-card.is-active").text()).toContain("System");
    expect(wrapper.find(".swatch.is-active").text()).toContain("rose");
  });

  it("applies a theme now and saves it to the account", async () => {
    const wrapper = mountSettings();
    await wrapper.findAll(".theme-card")[1]?.trigger("click");
    expect(setTheme).toHaveBeenCalledWith("dark");
    expect(savePreferences).toHaveBeenCalledWith({ theme: "dark" });
  });

  it("applies an accent now and saves it to the account", async () => {
    const wrapper = mountSettings();
    await wrapper.find('button[aria-label="emerald accent"]').trigger("click");
    expect(setAccent).toHaveBeenCalledWith("emerald");
    expect(savePreferences).toHaveBeenCalledWith({ accentColor: "emerald" });
  });
});
