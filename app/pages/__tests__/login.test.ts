import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import LoginPage from "../login.vue";

// Overridden per-test (#292) to simulate a redirect_url query param carried
// over from a "sign in to ..." link elsewhere in the app.
let routeQuery: Record<string, unknown> = {};
vi.stubGlobal("useRoute", () => ({ query: routeQuery }));

const signInStub = {
  template: '<div class="clerk-sign-in" />',
  props: ["fallbackRedirectUrl"],
};

const globalConfig = {
  global: {
    stubs: {
      AppIcon: { template: "<svg data-icon />" },
      AppThemeToggle: { template: '<div class="theme-toggle" />' },
      NuxtLink: { template: "<a><slot /></a>", props: ["to"] },
      SignIn: signInStub,
    },
  },
};

describe("Login page (/login)", () => {
  beforeEach(() => {
    routeQuery = {};
  });

  it("renders without crashing and matches snapshot", () => {
    const wrapper = mount(LoginPage, globalConfig);
    expect(wrapper.find(".auth").exists()).toBe(true);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("renders the brand panel on the left", () => {
    const wrapper = mount(LoginPage, globalConfig);
    expect(wrapper.find(".auth__brand").exists()).toBe(true);
    expect(wrapper.find(".brand-mid h1").text()).toContain("waiting");
  });

  it("renders the Clerk SignIn component on the right", () => {
    const wrapper = mount(LoginPage, globalConfig);
    expect(wrapper.find(".clerk-sign-in").exists()).toBe(true);
  });

  it("renders floating map pins on the brand panel", () => {
    const wrapper = mount(LoginPage, globalConfig);
    expect(wrapper.findAll(".pin-float").length).toBeGreaterThan(0);
  });

  it("renders stats in the brand panel", () => {
    const wrapper = mount(LoginPage, globalConfig);
    expect(wrapper.find(".stamp").exists()).toBe(true);
    expect(wrapper.html()).toContain("Streak");
    expect(wrapper.html()).toContain("Miles logged");
  });

  it("passes a redirect_url query param through to Clerk's SignIn as fallbackRedirectUrl (#292)", () => {
    routeQuery = { redirect_url: "/trips/abc123" };
    const wrapper = mount(LoginPage, globalConfig);

    const signIn = wrapper.findComponent(signInStub);
    expect(signIn.props("fallbackRedirectUrl")).toBe("/trips/abc123");
  });

  it("does not pass an absolute-URL redirect_url through, to prevent an open redirect (#292)", () => {
    routeQuery = { redirect_url: "https://evil.com" };
    const wrapper = mount(LoginPage, globalConfig);

    const signIn = wrapper.findComponent(signInStub);
    expect(signIn.props("fallbackRedirectUrl")).toBeNull();
  });

  it("passes null when no redirect_url query param is present", () => {
    const wrapper = mount(LoginPage, globalConfig);

    const signIn = wrapper.findComponent(signInStub);
    expect(signIn.props("fallbackRedirectUrl")).toBeNull();
  });
});
