import { describe, it, expect, vi, beforeEach } from "vitest";
import { computed, ref } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import IndexPage from "../index.vue";
import AppIcon from "../../components/AppIcon.vue";
import AppThemeToggle from "../../components/AppThemeToggle.vue";

vi.mock("~/composables/useOgMeta", () => ({ useOgMeta: vi.fn() }));

const isSignedInRef = ref(false);
const planRef = ref("drifter");
const mockNavigateTo = vi.fn();

vi.stubGlobal("navigateTo", mockNavigateTo);
vi.mock("~/composables/useBilling", () => ({
  useBilling: () => ({
    subscription: computed(() => ({ plan: planRef.value })),
    fetchSubscription: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.stubGlobal("useClerkAuth", () => ({
  isSignedIn: isSignedInRef,
  isLoaded: ref(true),
  getToken: vi.fn().mockResolvedValue(null),
}));

const planCheckoutButtonStub = {
  template:
    '<button class="plan-checkout-btn" :data-tier="tier"><slot /></button>',
  props: ["tier", "cycle", "redirectTo"],
};

const nuxtLinkStub = { template: "<a><slot /></a>", props: ["to"] };

const globalConfig = {
  global: {
    stubs: {
      AppIcon: { template: "<svg data-icon />" },
      AppThemeToggle: { template: '<div class="theme-toggle" />' },
      NuxtLink: nuxtLinkStub,
      MarketingNav: { template: "<nav />" },
      MarketingFooter: { template: "<footer />" },
      PlanCheckoutButton: planCheckoutButtonStub,
      PlanManageButton: {
        template: '<button class="plan-manage-btn"><slot /></button>',
      },
    },
  },
};

describe("Landing page (/)", () => {
  beforeEach(() => {
    isSignedInRef.value = false;
    planRef.value = "drifter";
    mockNavigateTo.mockClear();
  });

  it("sends the hero email to the sign-up route", async () => {
    const wrapper = mount(IndexPage, globalConfig);
    await wrapper.find('input[type="email"]').setValue("dan+test@example.com");
    await wrapper.find("form.lp-capture").trigger("submit");
    expect(mockNavigateTo).toHaveBeenCalledWith(
      "/sign-up?email=dan%2Btest%40example.com",
      { external: true },
    );
  });

  it("has no testimonials section", () => {
    const wrapper = mount(IndexPage, globalConfig);
    expect(wrapper.find("#loved").exists()).toBe(false);
  });

  it("uses a real image for all six photo slots", () => {
    const images = mount(IndexPage, globalConfig).findAll(
      ".place__img, .e3__img",
    );
    expect(images).toHaveLength(6);
    for (const image of images) {
      expect(image.attributes("src")).toMatch(/^\/images\/landing\//);
      expect(image.attributes("alt")).toBeTruthy();
    }
  });

  describe.each([
    ["drifter", "/pricing link", true],
    ["wanderer", "portal button", true],
    ["nomad", "nothing", false],
  ])("signed in as %s", (plan, _description, expectsUpgrade) => {
    it("shows the right upgrade action and no signup form", async () => {
      isSignedInRef.value = true;
      planRef.value = plan;
      const wrapper = mount(IndexPage, globalConfig);
      await flushPromises();

      const heroCopy = wrapper.find(".lp-hero__copy");
      expect(heroCopy.find("form").exists()).toBe(false);
      expect(heroCopy.text().includes("upgrade")).toBe(expectsUpgrade);
      expect(wrapper.findAll(".plan-manage-btn").length > 0).toBe(
        plan === "wanderer",
      );
      expect(wrapper.find(".cta").exists()).toBe(false);
    });
  });

  it("renders without crashing and matches snapshot", () => {
    const wrapper = mount(IndexPage, globalConfig);
    expect(wrapper.find("nav").exists()).toBe(true);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("renders the hero section", () => {
    const wrapper = mount(IndexPage, globalConfig);
    expect(wrapper.find(".lp-hero--a").exists()).toBe(true);
    expect(wrapper.find("h1").text()).toContain("living map");
  });

  it("renders all main sections", () => {
    const wrapper = mount(IndexPage, globalConfig);
    expect(wrapper.find("#features").exists()).toBe(true);
    expect(wrapper.find("#map").exists()).toBe(true);
    expect(wrapper.find("#how").exists()).toBe(true);
    expect(wrapper.find("#plans").exists()).toBe(true);
  });

  it("has three pricing tiers", () => {
    const wrapper = mount(IndexPage, globalConfig);
    expect(wrapper.findAll(".tier")).toHaveLength(3);
  });

  it("has email capture forms", () => {
    const wrapper = mount(IndexPage, globalConfig);
    expect(wrapper.findAll('input[type="email"]').length).toBeGreaterThan(0);
  });

  it("shows /login CTAs for the paid tiers when signed out", () => {
    const wrapper = mount(IndexPage, globalConfig);
    expect(wrapper.findAll(".plan-checkout-btn")).toHaveLength(0);
  });

  it("shows real checkout buttons for the paid tiers when signed in", () => {
    isSignedInRef.value = true;
    const wrapper = mount(IndexPage, globalConfig);

    const checkoutButtons = wrapper.findAll(".plan-checkout-btn");
    expect(checkoutButtons).toHaveLength(2);
    expect(
      checkoutButtons.map((button) => button.attributes("data-tier")),
    ).toEqual(["wanderer", "nomad"]);
  });
});
