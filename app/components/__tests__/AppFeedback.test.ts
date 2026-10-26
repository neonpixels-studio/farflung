import { describe, it, expect, vi, beforeEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import AppFeedback from "../AppFeedback.vue";
import InputText from "../InputText.vue";
import InputTextarea from "../InputTextarea.vue";
import AppAlert from "../AppAlert.vue";

const USER_EMAIL = "ada@example.com";

const apiFetchMock = vi.fn();

function signIn(isSignedIn: boolean): void {
  vi.mocked(useClerkAuth).mockReturnValue({
    isSignedIn: ref(isSignedIn),
    isLoaded: ref(true),
    getToken: vi.fn(),
  } as unknown as ReturnType<typeof useClerkAuth>);
  vi.mocked(useClerkUser).mockReturnValue({
    user: ref(
      isSignedIn ? { primaryEmailAddress: { emailAddress: USER_EMAIL } } : null,
    ),
  } as unknown as ReturnType<typeof useClerkUser>);
}

function mountFeedback() {
  return mount(AppFeedback, {
    attachTo: document.body,
    global: {
      components: { InputText, InputTextarea, AppAlert },
      stubs: { AppIcon: { template: "<svg data-icon />" } },
    },
  });
}

async function openDialog(wrapper: ReturnType<typeof mountFeedback>) {
  await wrapper.find(".feedback__fab").trigger("click");
  await flushPromises();
}

describe("AppFeedback", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    vi.mocked(useApiClient).mockReturnValue({
      apiFetch: apiFetchMock,
    } as unknown as ReturnType<typeof useApiClient>);
    signIn(true);
  });

  it("renders nothing for signed-out visitors", () => {
    signIn(false);
    const wrapper = mountFeedback();

    expect(wrapper.find(".feedback__fab").exists()).toBe(false);
  });

  it("shows a ? button that opens the feedback dialog", async () => {
    const wrapper = mountFeedback();
    const fab = wrapper.find(".feedback__fab");

    expect(fab.text()).toBe("?");
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);

    await openDialog(wrapper);

    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it("prefills the signed-in user's email", async () => {
    const wrapper = mountFeedback();
    await openDialog(wrapper);

    const emailInput = wrapper.find('input[name="email"]')
      .element as HTMLInputElement;
    expect(emailInput.value).toBe(USER_EMAIL);
    wrapper.unmount();
  });

  it("submits the message, email, and current page URL", async () => {
    apiFetchMock.mockResolvedValue({ ok: true });
    const wrapper = mountFeedback();
    await openDialog(wrapper);

    await wrapper.find('textarea[name="message"]').setValue("Love the map");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(apiFetchMock).toHaveBeenCalledWith("/api/feedback", {
      method: "POST",
      body: {
        message: "Love the map",
        email: USER_EMAIL,
        url: window.location.href,
      },
    });
    expect(wrapper.text()).toContain("Feedback sent");
    wrapper.unmount();
  });

  it("shows the server's error message when submission fails", async () => {
    apiFetchMock.mockRejectedValue({
      data: { statusMessage: "Feedback could not be sent; please try again" },
    });
    const wrapper = mountFeedback();
    await openDialog(wrapper);

    await wrapper.find('textarea[name="message"]').setValue("Hello");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(wrapper.text()).toContain(
      "Feedback could not be sent; please try again",
    );
    expect(wrapper.find("form").exists()).toBe(true);
    wrapper.unmount();
  });

  it("closes on Escape", async () => {
    const wrapper = mountFeedback();
    await openDialog(wrapper);

    await wrapper.find('[role="dialog"]').trigger("keydown", { key: "Escape" });

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    wrapper.unmount();
  });
});
