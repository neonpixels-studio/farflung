import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import ContactPage from "../contact.vue";
import InputText from "../../components/InputText.vue";
import InputTextarea from "../../components/InputTextarea.vue";
import AppAlert from "../../components/AppAlert.vue";
import { submitContactForm } from "~/utils/contactForm";

vi.mock("~/utils/contactForm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/utils/contactForm")>()),
  submitContactForm: vi.fn(),
}));

const submitMock = vi.mocked(submitContactForm);

const globalConfig = {
  global: {
    components: { InputText, InputTextarea, AppAlert },
    stubs: {
      AppIcon: { template: "<svg data-icon />" },
      AppThemeToggle: { template: '<div class="theme-toggle" />' },
      NuxtLink: { template: '<a :to="to"><slot /></a>', props: ["to"] },
    },
  },
};

async function fillAndSubmit(wrapper: ReturnType<typeof mount>) {
  await wrapper.find('input[name="name"]').setValue("Ada Lovelace");
  await wrapper.find('input[name="email"]').setValue("ada@example.com");
  await wrapper.find('textarea[name="message"]').setValue("Hello there");
  await wrapper.find("form").trigger("submit");
  await flushPromises();
}

describe("Contact page (/contact)", () => {
  beforeEach(() => {
    submitMock.mockReset();
  });

  it("renders the name, email, and message fields as required", () => {
    const wrapper = mount(ContactPage, globalConfig);
    expect(wrapper.find('input[name="name"]').attributes()).toHaveProperty(
      "required",
    );
    expect(wrapper.find('input[name="email"]').attributes("type")).toBe(
      "email",
    );
    expect(
      wrapper.find('textarea[name="message"]').attributes(),
    ).toHaveProperty("required");
  });

  it("submits the entered values and shows a success message", async () => {
    submitMock.mockResolvedValue(undefined);
    const wrapper = mount(ContactPage, globalConfig);

    await fillAndSubmit(wrapper);

    expect(submitMock).toHaveBeenCalledWith({
      name: "Ada Lovelace",
      email: "ada@example.com",
      message: "Hello there",
      "bot-field": "",
    });
    expect(wrapper.find("form").exists()).toBe(false);
    expect(wrapper.text()).toContain("Message sent");
  });

  it("keeps the form and shows an error when submission fails", async () => {
    submitMock.mockRejectedValue(new Error("boom"));
    const wrapper = mount(ContactPage, globalConfig);

    await fillAndSubmit(wrapper);

    expect(wrapper.find("form").exists()).toBe(true);
    expect(wrapper.find(".alert--error").exists()).toBe(true);
    expect(
      (wrapper.find('input[name="name"]').element as HTMLInputElement).value,
    ).toBe("Ada Lovelace");
  });
});

describe("public/__forms.html blueprint", () => {
  it("registers every field the page submits", () => {
    const html = readFileSync(
      resolve(process.cwd(), "public/__forms.html"),
      "utf8",
    );
    const form = new DOMParser()
      .parseFromString(html, "text/html")
      .querySelector('form[name="contact"]');

    expect(form?.getAttribute("data-netlify")).toBe("true");
    expect(form?.getAttribute("netlify-honeypot")).toBe("bot-field");
    for (const field of ["name", "email", "message", "bot-field"]) {
      expect(form?.querySelector(`[name="${field}"]`)).not.toBeNull();
    }
  });
});
