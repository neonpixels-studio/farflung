import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { mount } from "@vue/test-utils";
import IndexPage from "../index.vue";
import AppIcon from "../../components/AppIcon.vue";
import AppThemeToggle from "../../components/AppThemeToggle.vue";

const isSignedInRef = ref(false);

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
      PlanCheckoutButton: planCheckoutButtonStub,
    },
  },
};

describe("Landing page (/)", () => {
  beforeEach(() => {
    isSignedInRef.value = false;
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

  it("has three testimonials", () => {
    const wrapper = mount(IndexPage, globalConfig);
    expect(wrapper.findAll(".quote")).toHaveLength(3);
  });

  it("has email capture forms", () => {
    const wrapper = mount(IndexPage, globalConfig);
    expect(wrapper.findAll('input[type="email"]').length).toBeGreaterThan(0);
  });

  it("renders the footer", () => {
    const wrapper = mount(IndexPage, globalConfig);
    expect(wrapper.find("footer.ftr").exists()).toBe(true);
  });

  it("links the nav to sign-in when signed out", () => {
    const wrapper = mount(IndexPage, globalConfig);
    const navLinks = wrapper.find("nav").findAllComponents(nuxtLinkStub);
    const targets = navLinks.map((link) => link.props("to"));

    expect(wrapper.find("nav").text()).toContain("Sign in");
    expect(wrapper.find("nav").text()).not.toContain("Dashboard");
    expect(targets).toEqual(["/", "/login", "/login"]);
  });

  it("links the nav to the dashboard when signed in", () => {
    isSignedInRef.value = true;
    const wrapper = mount(IndexPage, globalConfig);
    const navLinks = wrapper.find("nav").findAllComponents(nuxtLinkStub);
    const targets = navLinks.map((link) => link.props("to"));

    expect(wrapper.find("nav").text()).toContain("Dashboard");
    expect(wrapper.find("nav").text()).not.toContain("Sign in");
    expect(targets).toEqual(["/", "/home", "/home"]);
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
