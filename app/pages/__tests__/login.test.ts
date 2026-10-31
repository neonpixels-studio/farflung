import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import LoginPage from "../login.vue";
import { AUTH_REDIRECT_QUERY_PARAM } from "~/utils/authRedirect";

// Overridden per-test (#292) to simulate a return_to query param carried over
// from a "sign in to ..." link elsewhere in the app.
let routeQuery: Record<string, unknown> = {};
vi.stubGlobal("useRoute", () => ({ query: routeQuery }));

const signInStub = {
  template: '<div class="clerk-sign-in" />',
  props: [
    "fallbackRedirectUrl",
    "signUpFallbackRedirectUrl",
    "routing",
    "path",
  ],
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

  it("has no theme switcher, so the page follows the system theme", () => {
    const wrapper = mount(LoginPage, globalConfig);
    expect(wrapper.find(".theme-toggle").exists()).toBe(false);
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

  it("passes a return_to query param through to Clerk's SignIn as both fallback redirect props (#292)", () => {
    routeQuery = { [AUTH_REDIRECT_QUERY_PARAM]: "/trips/abc123" };
    const wrapper = mount(LoginPage, globalConfig);

    const signIn = wrapper.findComponent(signInStub);
    expect(signIn.props("fallbackRedirectUrl")).toBe("/trips/abc123");
    // Bound to sign-up's fallback too, so a visitor without an account who
    // signs up instead (from the same embedded form) lands on the same
    // destination as a visitor who signs in (#292).
    expect(signIn.props("signUpFallbackRedirectUrl")).toBe("/trips/abc123");
  });

  it.each([
    ["an absolute URL to another origin", "https://evil.com"],
    ["a protocol-relative URL", "//evil.com"],
    [
      "a dot-segment value that normalizes to protocol-relative",
      "/.//evil.com",
    ],
    ["a value that resolves back to the login page itself", "/login"],
  ])(
    "does not pass %s through, to prevent an open redirect or self-bounce (#292)",
    (_description, unsafeValue) => {
      routeQuery = { [AUTH_REDIRECT_QUERY_PARAM]: unsafeValue };
      const wrapper = mount(LoginPage, globalConfig);

      const signIn = wrapper.findComponent(signInStub);
      expect(signIn.props("fallbackRedirectUrl")).toBe("/home");
      expect(signIn.props("signUpFallbackRedirectUrl")).toBe("/home");
    },
  );

  it("routes Clerk's sign-in steps under /login", () => {
    const signIn = mount(LoginPage, globalConfig).findComponent(signInStub);

    expect(signIn.props("routing")).toBe("path");
    expect(signIn.props("path")).toBe("/login");
  });

  it("matches Clerk's sub-paths with a catch-all route", () => {
    const source = readFileSync(resolve(__dirname, "../login.vue"), "utf8");

    expect(source).toContain('path: "/login/:clerkStep(.*)*"');
  });

  it("sends visitors to the dashboard when no return_to query param is present", () => {
    const wrapper = mount(LoginPage, globalConfig);

    const signIn = wrapper.findComponent(signInStub);
    expect(signIn.props("fallbackRedirectUrl")).toBe("/home");
    expect(signIn.props("signUpFallbackRedirectUrl")).toBe("/home");
  });
});
