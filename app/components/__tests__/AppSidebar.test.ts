import { describe, it, expect, vi } from "vitest";
import { computed } from "vue";
import { mount } from "@vue/test-utils";
import AppSidebar from "../AppSidebar.vue";

function mountAt(path: string) {
  vi.stubGlobal("useClerkUser", () => ({ user: { value: null } }));
  vi.stubGlobal("useRoute", () => ({ path }));
  vi.stubGlobal("computed", computed);
  return mount(AppSidebar, {
    props: { isOpen: false },
    global: {
      stubs: {
        NuxtLink: { template: "<a><slot /></a>" },
        AppIcon: true,
        AppThemeToggle: true,
      },
    },
  });
}

function activeLabels(path: string) {
  return mountAt(path)
    .findAll(".nav__item.is-active")
    .map((item) => item.text());
}

describe("AppSidebar", () => {
  it("marks only the current page's nav item active", () => {
    expect(activeLabels("/journal")).toEqual(["Journal"]);
  });

  it("keeps the section active on a nested route", () => {
    expect(activeLabels("/trips/abc")).toEqual(["Trips"]);
  });

  it("does not match a different page sharing a prefix", () => {
    expect(activeLabels("/mapping")).toEqual([]);
  });
});
