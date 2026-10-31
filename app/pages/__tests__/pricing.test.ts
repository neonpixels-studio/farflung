import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { mount } from "@vue/test-utils";
import PricingPage from "../pricing.vue";

vi.mock("~/composables/useOgMeta", () => ({ useOgMeta: vi.fn() }));

const isSignedInRef = ref(false);

vi.stubGlobal("useClerkAuth", () => ({
  isSignedIn: isSignedInRef,
  isLoaded: ref(true),
  getToken: vi.fn().mockResolvedValue(null),
}));

const planCheckoutButtonStub = {
  template:
    '<button class="plan-checkout-btn" :data-tier="tier" :data-cycle="cycle"><slot /></button>',
  props: ["tier", "cycle", "redirectTo"],
};

const globalConfig = {
  global: {
    stubs: {
      AppIcon: { template: "<svg data-icon />" },
      AppThemeToggle: { template: '<div class="theme-toggle" />' },
      NuxtLink: { template: '<a :to="to"><slot /></a>', props: ["to"] },
      PlanCheckoutButton: planCheckoutButtonStub,
    },
  },
};

describe("Pricing page (/pricing)", () => {
  beforeEach(() => {
    isSignedInRef.value = false;
  });

  it("renders without crashing and matches snapshot", () => {
    const wrapper = mount(PricingPage, globalConfig);
    expect(wrapper.find("table.cmp").exists()).toBe(true);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("shows monthly prices by default", () => {
    const wrapper = mount(PricingPage, globalConfig);
    expect(wrapper.html()).toContain("$8");
    expect(wrapper.html()).toContain("$16");
  });

  it("switches to yearly pricing when yearly button is clicked", async () => {
    const wrapper = mount(PricingPage, globalConfig);
    const buttons = wrapper.findAll(".billing button");
    await buttons[1].trigger("click");
    expect(wrapper.html()).toContain("$6");
    expect(wrapper.html()).toContain("$12");
    expect(wrapper.html()).toContain("/mo·yr");
  });

  it("has the three plan columns", () => {
    const wrapper = mount(PricingPage, globalConfig);
    expect(wrapper.find(".thd--pop").exists()).toBe(true);
    expect(wrapper.html()).toContain("Drifter");
    expect(wrapper.html()).toContain("Wanderer");
    expect(wrapper.html()).toContain("Nomad");
  });

  it("labels unbuilt features coming soon and drops tiered support", () => {
    const wrapper = mount(PricingPage, globalConfig);
    const rowFor = (name: string) =>
      wrapper
        .findAll(".feat-row")
        .find((row) => row.find("td").text() === name);
    for (const feature of [
      "GPX route import / export",
      "Original-resolution backup",
      "Offline maps",
      "Year-in-review",
      "Collaborative trips",
    ]) {
      expect(rowFor(feature)?.text()).toContain("coming soon");
    }
    expect(rowFor("Support")).toBeUndefined();
  });

  it("renders category rows", () => {
    const wrapper = mount(PricingPage, globalConfig);
    expect(wrapper.findAll(".cat-row").length).toBeGreaterThan(0);
  });

  it("highlights the Wanderer column as popular", () => {
    const wrapper = mount(PricingPage, globalConfig);
    expect(wrapper.find(".thd--pop").text()).toContain("Wanderer");
  });

  it("sends signed-out visitors to /sign-up from the paid tiers", () => {
    const wrapper = mount(PricingPage, globalConfig);
    expect(wrapper.findAll(".plan-checkout-btn")).toHaveLength(0);
    expect(wrapper.find(".thd--pop a").attributes("to")).toBe("/sign-up");
  });

  it("shows real checkout buttons for the paid tiers when signed in", () => {
    isSignedInRef.value = true;
    const wrapper = mount(PricingPage, globalConfig);

    // One PlanCheckoutButton per paid tier per row (header + footer) = 4.
    const checkoutButtons = wrapper.findAll(".plan-checkout-btn");
    expect(checkoutButtons).toHaveLength(4);
    expect(
      checkoutButtons.map((button) => button.attributes("data-tier")),
    ).toEqual(["wanderer", "nomad", "wanderer", "nomad"]);
  });

  it("passes the selected billing cycle through to the checkout button", async () => {
    isSignedInRef.value = true;
    const wrapper = mount(PricingPage, globalConfig);

    const buttons = wrapper.findAll(".billing button");
    await buttons[1].trigger("click");

    const checkoutButtons = wrapper.findAll(".plan-checkout-btn");
    expect(checkoutButtons[0].attributes("data-cycle")).toBe("yearly");
  });

  it("still shows the free Drifter tier as a plain link when signed in", () => {
    isSignedInRef.value = true;
    const wrapper = mount(PricingPage, globalConfig);
    expect(wrapper.find(".thd a").attributes("to")).toBe("/home");
  });
});
