import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import MarketingFooter from "../MarketingFooter.vue";

const nuxtLinkStub = { template: "<a><slot /></a>", props: ["to"] };

function mountFooter() {
  return mount(MarketingFooter, {
    global: {
      stubs: { AppIcon: true, AppThemeToggle: true, NuxtLink: nuxtLinkStub },
    },
  });
}

describe("MarketingFooter", () => {
  it("drops the deleted items", () => {
    const text = mountFooter().text();
    expect(text).not.toContain("Product tour");
    expect(text).not.toContain("Journal blog");
    expect(text).not.toContain("JetBrains Mono");
  });

  it("uses absolute section links so they work from any marketing page", () => {
    const targets = mountFooter()
      .findAllComponents(nuxtLinkStub)
      .map((link) => String(link.props("to")));
    expect(targets).toContain("/#features");
    expect(targets.some((target) => target.startsWith("#"))).toBe(false);
  });
});
