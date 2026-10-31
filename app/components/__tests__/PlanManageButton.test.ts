import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import PlanManageButton from "../PlanManageButton.vue";

const mockApiFetch = vi.fn();
vi.mock("~/composables/useApiClient", () => ({
  useApiClient: () => ({ apiFetch: mockApiFetch }),
}));

describe("PlanManageButton", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    mockApiFetch.mockReset();
    mockApiFetch.mockResolvedValue({ url: "https://billing.stripe.test/s" });
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, href: "" },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("renders slot content", () => {
    const wrapper = mount(PlanManageButton, {
      slots: { default: "manage subscription" },
    });

    expect(wrapper.text()).toContain("manage subscription");
  });

  it("requests the portal through the authenticated client, then navigates", async () => {
    const wrapper = mount(PlanManageButton);

    await wrapper.find("button").trigger("click");
    await flushPromises();

    expect(mockApiFetch).toHaveBeenCalledWith("/api/billing/portal");
    expect(window.location.href).toBe("https://billing.stripe.test/s");
  });

  it("shows the error and stays put when the request fails", async () => {
    mockApiFetch.mockRejectedValue({
      data: { statusMessage: "No billing account found for this user" },
    });
    const wrapper = mount(PlanManageButton);

    await wrapper.find("button").trigger("click");
    await flushPromises();

    expect(window.location.href).toBe("");
    expect(wrapper.find('[role="alert"]').text()).toBe(
      "No billing account found for this user",
    );
    expect(wrapper.find("button").attributes("disabled")).toBeUndefined();
  });

  it("forwards attrs like class onto the rendered button", () => {
    const wrapper = mount(PlanManageButton, {
      attrs: { class: "btn btn--outline" },
    });
    expect(wrapper.find("button").classes()).toContain("btn--outline");
  });
});
