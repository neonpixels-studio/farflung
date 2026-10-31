import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";
import AppThemeToggle from "../AppThemeToggle.vue";

const theme = ref("system");
const setTheme = vi.fn((next: string) => {
  theme.value = next;
});

function mountToggle() {
  vi.stubGlobal("useTheme", () => ({ theme, setTheme }));
  return mount(AppThemeToggle, { global: { stubs: { AppIcon: true } } });
}

describe("AppThemeToggle", () => {
  beforeEach(() => {
    theme.value = "system";
    setTheme.mockClear();
  });

  it("highlights System by default", () => {
    const active = mountToggle().findAll("button.is-active");
    expect(active).toHaveLength(1);
    expect(active[0]?.attributes("aria-label")).toBe("System theme");
  });

  it.each([
    ["Light theme", "light"],
    ["Dark theme", "dark"],
    ["System theme", "system"],
  ])("%s selects %s", async (label, value) => {
    const wrapper = mountToggle();
    await wrapper.find(`button[aria-label="${label}"]`).trigger("click");
    expect(setTheme).toHaveBeenCalledWith(value);
  });
});
