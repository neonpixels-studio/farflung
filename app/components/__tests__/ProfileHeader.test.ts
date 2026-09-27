import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ProfileHeader from "../ProfileHeader.vue";
import { buildLoginPath } from "~/utils/authRedirect";

const globalConfig = {
  global: {
    stubs: {
      AppIcon: { template: "<svg data-icon />" },
      NuxtLink: { template: '<a :href="to"><slot /></a>', props: ["to"] },
    },
  },
};

const BASE_PROPS = {
  displayName: "Elsa",
  handleLabel: "@elsa_far",
  homeBase: "Reykjavik",
  isSelf: false,
  following: false,
  pending: false,
  viewerIsSignedIn: true,
  viewerAuthLoaded: true,
  // signInHref is required (#292); this default is unused whenever
  // viewerIsSignedIn is true (BASE_PROPS' own default), since the follow
  // button renders instead of the sign-in link.
  signInHref: "/login",
};

describe("ProfileHeader", () => {
  it("renders the name, handle, and home base and matches snapshot", () => {
    const wrapper = mount(ProfileHeader, {
      ...globalConfig,
      props: BASE_PROPS,
    });

    expect(wrapper.find(".phead__id h1").text()).toBe("Elsa");
    expect(wrapper.find(".phead__handle").text()).toBe("@elsa_far");
    expect(wrapper.find(".phead__home").text()).toContain("Reykjavik");
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("shows a follow button when viewing someone else's profile", () => {
    const wrapper = mount(ProfileHeader, {
      ...globalConfig,
      props: BASE_PROPS,
    });

    expect(wrapper.find("button").text().toLowerCase()).toContain("follow");
  });

  it("hides the follow button on your own profile", () => {
    const wrapper = mount(ProfileHeader, {
      ...globalConfig,
      props: { ...BASE_PROPS, isSelf: true },
    });

    expect(wrapper.find("button").exists()).toBe(false);
  });

  it("emits toggle when the follow button is clicked", async () => {
    const wrapper = mount(ProfileHeader, {
      ...globalConfig,
      props: BASE_PROPS,
    });

    await wrapper.find("button").trigger("click");

    expect(wrapper.emitted("toggle")).toHaveLength(1);
  });

  it("disables the follow button while a toggle is pending", () => {
    const wrapper = mount(ProfileHeader, {
      ...globalConfig,
      props: { ...BASE_PROPS, pending: true },
    });

    expect(wrapper.find("button").attributes("disabled")).toBeDefined();
  });

  it("shows the following state when already following", () => {
    const wrapper = mount(ProfileHeader, {
      ...globalConfig,
      props: { ...BASE_PROPS, following: true },
    });

    expect(wrapper.find("button").text().toLowerCase()).toContain("following");
    expect(wrapper.find("button").classes()).toContain("btn--primary");
  });

  it("omits the handle and home base rows when they are absent", () => {
    const wrapper = mount(ProfileHeader, {
      ...globalConfig,
      props: { ...BASE_PROPS, handleLabel: "", homeBase: null },
    });

    expect(wrapper.find(".phead__handle").exists()).toBe(false);
    expect(wrapper.find(".phead__home").exists()).toBe(false);
  });

  it("shows a sign-in prompt instead of a follow button for a signed-out viewer", () => {
    const wrapper = mount(ProfileHeader, {
      ...globalConfig,
      props: {
        ...BASE_PROPS,
        viewerIsSignedIn: false,
        viewerAuthLoaded: true,
      },
    });

    expect(wrapper.find("button").exists()).toBe(false);
    const signInLink = wrapper.find("a");
    expect(signInLink.exists()).toBe(true);
    expect(signInLink.text().toLowerCase()).toContain("sign in");
    expect(signInLink.attributes("href")).toBe(BASE_PROPS.signInHref);
  });

  it("carries a caller-provided sign-in redirect through the link (#292)", () => {
    const signInHref = buildLoginPath("/u/elsa");
    const wrapper = mount(ProfileHeader, {
      ...globalConfig,
      props: {
        ...BASE_PROPS,
        viewerIsSignedIn: false,
        viewerAuthLoaded: true,
        signInHref,
      },
    });

    const signInLink = wrapper.find("a");
    expect(signInLink.attributes("href")).toBe(signInHref);
  });

  it("shows neither a follow button nor a sign-in prompt while auth is still resolving", () => {
    const wrapper = mount(ProfileHeader, {
      ...globalConfig,
      props: {
        ...BASE_PROPS,
        viewerIsSignedIn: false,
        viewerAuthLoaded: false,
      },
    });

    expect(wrapper.find("button").exists()).toBe(false);
    expect(wrapper.find("a").exists()).toBe(false);
  });
});
