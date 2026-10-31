import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import PrivacyPage from "../privacy.vue";
import TermsPage from "../terms.vue";
import LegalPage from "../../components/LegalPage.vue";

vi.mock("~/composables/useOgMeta", () => ({ useOgMeta: vi.fn() }));

const globalConfig = {
  global: {
    components: { LegalPage },
    stubs: {
      AppIcon: { template: "<svg data-icon />" },
      AppThemeToggle: { template: '<div class="theme-toggle" />' },
      NuxtLink: { template: '<a :href="to"><slot /></a>', props: ["to"] },
    },
  },
};

describe.each([
  ["privacy", PrivacyPage, "Privacy Policy"],
  ["terms", TermsPage, "Terms of Service"],
])("%s page", (_name, page, title) => {
  it("renders its title, draft notice and contact link", () => {
    const wrapper = mount(page, globalConfig);

    expect(wrapper.find("h1").text()).toBe(title);
    expect(wrapper.find(".legal__notice").text()).toContain("Draft");
    expect(wrapper.find('.legal a[href="/contact"]').exists()).toBe(true);
  });
});

describe("landing footer", () => {
  it("links to the legal pages", () => {
    const source = readFileSync(
      resolve(__dirname, "../../components/MarketingFooter.vue"),
      "utf8",
    );

    expect(source).toContain('to="/privacy"');
    expect(source).toContain('to="/terms"');
  });
});
