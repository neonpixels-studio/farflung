import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import GuideForm from "../GuideForm.vue";
import type { Guide } from "~/stores/guides";
import { inputStub, textareaStub } from "./input-stubs";

const globalConfig = {
  global: {
    stubs: {
      AppIcon: { template: "<svg data-icon />" },
      InputText: inputStub,
      InputTextarea: textareaStub,
    },
  },
};

const SAMPLE_GUIDE: Guide = {
  id: "g-1",
  userId: "user-1",
  title: "Tokyo on foot",
  body: "Start in Yanaka at sunrise.",
  readTimeMinutes: 8,
  likeCount: 12,
  visibility: "public",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("GuideForm", () => {
  it("renders without crashing and matches snapshot", () => {
    const wrapper = mount(
      GuideForm,
      Object.assign({}, globalConfig, {
        props: { title: "New guide", submitLabel: "publish guide" },
      }),
    );
    expect(wrapper.find(".guide-form").exists()).toBe(true);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("disables the submit button when the title is blank", () => {
    const wrapper = mount(GuideForm, {
      ...globalConfig,
      props: { title: "New guide", submitLabel: "publish guide" },
    });

    expect(
      wrapper.find('button[type="submit"]').attributes("disabled"),
    ).toBeDefined();
  });

  it("enables the submit button once a title is entered", async () => {
    const wrapper = mount(GuideForm, {
      ...globalConfig,
      props: { title: "New guide", submitLabel: "publish guide" },
    });

    await wrapper
      .find('input[placeholder="Guide title…"]')
      .setValue("Slow coastlines");

    expect(
      wrapper.find('button[type="submit"]').attributes("disabled"),
    ).toBeUndefined();
  });

  it("emits submit with the entered fields", async () => {
    const wrapper = mount(GuideForm, {
      ...globalConfig,
      props: { title: "New guide", submitLabel: "publish guide" },
    });

    await wrapper
      .find('input[placeholder="Guide title…"]')
      .setValue("Slow coastlines");
    await wrapper
      .find('textarea[placeholder="What should a fellow traveler know?"]')
      .setValue("Start at the north jetty.");
    await wrapper.find(".guide-form__number").setValue(7);
    await wrapper.find(".guide-form__select").setValue("public");
    await wrapper.find("form").trigger("submit");

    expect(wrapper.emitted("submit")).toBeTruthy();
    expect(wrapper.emitted("submit")?.[0]![0]).toEqual({
      title: "Slow coastlines",
      body: "Start at the north jetty.",
      readTimeMinutes: 7,
      visibility: "public",
    });
  });

  it("omits readTimeMinutes with no error when the field is left blank", async () => {
    const wrapper = mount(GuideForm, {
      ...globalConfig,
      props: { title: "New guide", submitLabel: "publish guide" },
    });

    await wrapper
      .find('input[placeholder="Guide title…"]')
      .setValue("Slow coastlines");
    // Simulate a cleared <input type="number">, which v-model.number leaves
    // as an empty string rather than coercing to a number.
    await wrapper.find(".guide-form__number").setValue("");
    await wrapper.find("form").trigger("submit");

    expect(wrapper.emitted("submit")?.[0]![0]).toMatchObject({
      readTimeMinutes: undefined,
    });
    expect(wrapper.find(".guide-form__field-error").exists()).toBe(false);
  });

  it("blocks the submit and shows an error for a non-blank invalid read time", async () => {
    const wrapper = mount(GuideForm, {
      ...globalConfig,
      props: { title: "New guide", submitLabel: "publish guide" },
    });

    await wrapper
      .find('input[placeholder="Guide title…"]')
      .setValue("Slow coastlines");
    await wrapper.find(".guide-form__number").setValue(0);
    await wrapper.find("form").trigger("submit");

    expect(wrapper.emitted("submit")).toBeFalsy();
    expect(wrapper.find(".guide-form__field-error").exists()).toBe(true);
  });

  it("does not emit submit when the title is only whitespace", async () => {
    const wrapper = mount(GuideForm, {
      ...globalConfig,
      props: { title: "New guide", submitLabel: "publish guide" },
    });

    await wrapper.find('input[placeholder="Guide title…"]').setValue("   ");
    await wrapper.find("form").trigger("submit");

    expect(wrapper.emitted("submit")).toBeFalsy();
  });

  it("emits cancel when the cancel button is clicked", async () => {
    const wrapper = mount(GuideForm, {
      ...globalConfig,
      props: { title: "New guide", submitLabel: "publish guide" },
    });

    await wrapper.find('button[type="button"]').trigger("click");

    expect(wrapper.emitted("cancel")).toBeTruthy();
  });

  it("pre-fills fields from initialGuide for editing", () => {
    const wrapper = mount(GuideForm, {
      ...globalConfig,
      props: {
        title: "Edit guide",
        submitLabel: "save changes",
        initialGuide: SAMPLE_GUIDE,
      },
    });

    const titleInput = wrapper.find(
      'input[placeholder="Guide title…"]',
    ) as unknown as { element: HTMLInputElement };
    expect(titleInput.element.value).toBe("Tokyo on foot");
    expect(
      (wrapper.find(".guide-form__select").element as HTMLSelectElement).value,
    ).toBe("public");
    expect(
      (wrapper.find(".guide-form__number").element as HTMLInputElement).value,
    ).toBe("8");
  });

  it("shows the error message when provided", () => {
    const wrapper = mount(GuideForm, {
      ...globalConfig,
      props: {
        title: "New guide",
        submitLabel: "publish guide",
        error: "Failed to create guide",
      },
    });

    expect(wrapper.find(".guide-form__error").text()).toBe(
      "Failed to create guide",
    );
  });

  it("shows a saving state and disables submit while pending", async () => {
    const wrapper = mount(GuideForm, {
      ...globalConfig,
      props: { title: "New guide", submitLabel: "publish guide" },
    });

    await wrapper
      .find('input[placeholder="Guide title…"]')
      .setValue("Slow coastlines");
    await wrapper.setProps({ pending: true });

    expect(wrapper.find('button[type="submit"]').text()).toContain("saving…");
    expect(
      wrapper.find('button[type="submit"]').attributes("disabled"),
    ).toBeDefined();
  });
});
