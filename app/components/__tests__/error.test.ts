import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ErrorPage from "../../error.vue";

const iconStub = { template: "<svg data-icon />" };
const linkStub = { template: "<a><slot /></a>", props: ["to"] };
const themeToggleStub = { template: '<div class="theme-toggle" />' };

const globalConfig = {
  global: {
    stubs: {
      AppIcon: iconStub,
      AppThemeToggle: themeToggleStub,
      NuxtLink: linkStub,
    },
  },
};

describe("Error page (app/error.vue)", () => {
  it("renders without crashing and matches snapshot", () => {
    const wrapper = mount(ErrorPage, {
      props: { error: null },
      ...globalConfig,
    });
    expect(wrapper.find(".nf").exists()).toBe(true);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("shows the default 404 status code when error is null", () => {
    const wrapper = mount(ErrorPage, {
      props: { error: null },
      ...globalConfig,
    });
    expect(wrapper.find(".label").text()).toContain("404");
  });

  it("shows a custom status code from the error prop", () => {
    const wrapper = mount(ErrorPage, {
      props: {
        error: {
          statusCode: 500,
          statusMessage: "Server Error",
          message: "Internal Server Error",
        } as any,
      },
      ...globalConfig,
    });
    expect(wrapper.find(".label").text()).toContain("500");
  });

  it("renders the 404 display with pin icon between the 4s", () => {
    const wrapper = mount(ErrorPage, {
      props: { error: null },
      ...globalConfig,
    });
    const code = wrapper.find(".nf__code");
    expect(code.exists()).toBe(true);
    expect(code.find(".nf__o").exists()).toBe(true);
  });

  it("renders the heading and description", () => {
    const wrapper = mount(ErrorPage, {
      props: { error: null },
      ...globalConfig,
    });
    expect(wrapper.find(".nf h1").text()).toBe("This place isn't on the map.");
    expect(wrapper.find(".nf p").text()).toContain("wandered off");
  });

  it("renders 2 CTA buttons", () => {
    const wrapper = mount(ErrorPage, {
      props: { error: null },
      ...globalConfig,
    });
    const cta = wrapper.find(".nf__cta");
    expect(cta.findAll(".btn")).toHaveLength(2);
  });

  it("renders the coords hint", () => {
    const wrapper = mount(ErrorPage, {
      props: { error: null },
      ...globalConfig,
    });
    expect(wrapper.find(".nf__coords").text()).toContain("lat 0.0000");
  });

  it("renders brand and theme toggle in the header", () => {
    const wrapper = mount(ErrorPage, {
      props: { error: null },
      ...globalConfig,
    });
    expect(wrapper.find(".nf-top .brand").exists()).toBe(true);
    expect(wrapper.find(".theme-toggle").exists()).toBe(true);
  });

  it("renders the footer copyright", () => {
    const wrapper = mount(ErrorPage, {
      props: { error: null },
      ...globalConfig,
    });
    expect(wrapper.find(".nf-foot").text()).toContain("farflung");
    expect(wrapper.find(".nf-foot").text()).toContain("2026");
  });
});
