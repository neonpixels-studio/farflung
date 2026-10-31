import { describe, it, expect, vi, beforeEach } from "vitest";
import { computed, ref } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import MarketingNav from "../MarketingNav.vue";

const isSignedInRef = ref(false);
const planRef = ref("drifter");

vi.stubGlobal("useClerkAuth", () => ({ isSignedIn: isSignedInRef }));
vi.mock("~/composables/useBilling", () => ({
  useBilling: () => ({
    subscription: computed(() => ({ plan: planRef.value })),
    fetchSubscription: vi.fn().mockResolvedValue(undefined),
  }),
}));

const nuxtLinkStub = { template: '<a :href="to"><slot /></a>', props: ["to"] };

function mountNav() {
  return mount(MarketingNav, {
    global: {
      stubs: {
        AppIcon: true,
        AppThemeToggle: true,
        NuxtLink: nuxtLinkStub,
        PlanManageButton: {
          template: '<button class="plan-manage-btn"><slot /></button>',
        },
      },
    },
  });
}

function linkTargets(wrapper: ReturnType<typeof mountNav>) {
  return wrapper.findAll("a").map((link) => link.attributes("href"));
}

describe("MarketingNav", () => {
  beforeEach(() => {
    isSignedInRef.value = false;
    planRef.value = "drifter";
  });

  it("offers sign in and signup when signed out", () => {
    expect(linkTargets(mountNav())).toEqual([
      "/",
      "/#features",
      "/#how",
      "/#plans",
      "/login",
      "/sign-up",
    ]);
  });

  it("uses absolute section links so they work from any marketing page", () => {
    for (const target of linkTargets(mountNav())) {
      expect(String(target).startsWith("#")).toBe(false);
    }
  });

  it("does not offer an upgrade before the plan has loaded", () => {
    isSignedInRef.value = true;
    planRef.value = "nomad";
    expect(mountNav().text()).not.toContain("upgrade");
  });

  it("links a Drifter to pricing", async () => {
    isSignedInRef.value = true;
    const wrapper = mountNav();
    await flushPromises();
    expect(linkTargets(wrapper)).toContain("/pricing");
    expect(linkTargets(wrapper)).toContain("/home");
    expect(linkTargets(wrapper)).not.toContain("/sign-up");
  });

  it("sends a Wanderer to the billing portal", async () => {
    isSignedInRef.value = true;
    planRef.value = "wanderer";
    const wrapper = mountNav();
    await flushPromises();
    expect(wrapper.find(".plan-manage-btn").text()).toBe("upgrade");
  });

  it("offers a Nomad no upgrade", async () => {
    isSignedInRef.value = true;
    planRef.value = "nomad";
    const wrapper = mountNav();
    await flushPromises();
    expect(wrapper.text()).not.toContain("upgrade");
  });
});
