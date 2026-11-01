import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import {
  isCommandPaletteShortcut,
  useCommandPaletteShortcut,
} from "../useCommandPaletteShortcut";

describe("isCommandPaletteShortcut", () => {
  it("matches Cmd+K on Mac", () => {
    const event = new KeyboardEvent("keydown", { key: "k", metaKey: true });
    expect(isCommandPaletteShortcut(event)).toBe(true);
  });

  it("matches Ctrl+K on Windows/Linux", () => {
    const event = new KeyboardEvent("keydown", { key: "K", ctrlKey: true });
    expect(isCommandPaletteShortcut(event)).toBe(true);
  });

  it("does not match K without a modifier", () => {
    const event = new KeyboardEvent("keydown", { key: "k" });
    expect(isCommandPaletteShortcut(event)).toBe(false);
  });

  it("does not match other keys even with a modifier", () => {
    const event = new KeyboardEvent("keydown", { key: "j", metaKey: true });
    expect(isCommandPaletteShortcut(event)).toBe(false);
  });
});

// Mounts a bare host component so onMounted/onUnmounted (used internally by
// useCommandPaletteShortcut) have a real component instance to attach to.
function mountHost(onTrigger: () => void) {
  return mount(
    defineComponent({
      setup() {
        useCommandPaletteShortcut(onTrigger);
        return () => null;
      },
    }),
  );
}

describe("useCommandPaletteShortcut", () => {
  let onTrigger: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    onTrigger = vi.fn<() => void>();
  });

  it("calls onTrigger when Cmd+K is pressed while mounted", () => {
    mountHost(onTrigger);

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true }),
    );

    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it("does not call onTrigger for unrelated key presses", () => {
    mountHost(onTrigger);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));

    expect(onTrigger).not.toHaveBeenCalled();
  });

  it("stops listening once the component unmounts", () => {
    const wrapper = mountHost(onTrigger);
    wrapper.unmount();

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true }),
    );

    expect(onTrigger).not.toHaveBeenCalled();
  });
});
