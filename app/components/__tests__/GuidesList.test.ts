import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import GuidesList from "../GuidesList.vue";
import type { Guide } from "~/stores/guides";
import { inputStub, textareaStub } from "./input-stubs";

const SAMPLE_GUIDES: Guide[] = [
  {
    id: "g-1",
    userId: "user-1",
    title: "Tokyo on foot",
    body: "Start in Yanaka at sunrise.",
    readTimeMinutes: 8,
    likeCount: 12,
    visibility: "public",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

const globalConfig = {
  global: {
    stubs: {
      AppIcon: { template: "<svg data-icon />" },
      InputText: inputStub,
      InputTextarea: textareaStub,
    },
  },
};

const BASE_PROPS = {
  guides: [] as Guide[],
  isLoading: false,
  hasLoaded: true,
  editingGuideId: null,
  deletingGuideIds: new Set<string>(),
  likedGuideIds: new Set<string>(),
  isSavingGuide: false,
  formError: null,
};

describe("GuidesList", () => {
  it("shows the loading state before any guides have loaded", () => {
    const wrapper = mount(GuidesList, {
      ...globalConfig,
      props: { ...BASE_PROPS, isLoading: true, hasLoaded: false },
    });
    expect(wrapper.text()).toContain("Loading guides");
  });

  it("does not blank the list when refetching while guides are already shown", () => {
    const wrapper = mount(GuidesList, {
      ...globalConfig,
      props: { ...BASE_PROPS, guides: SAMPLE_GUIDES, isLoading: true },
    });
    expect(wrapper.findAll(".gcard")).toHaveLength(1);
    expect(wrapper.text()).not.toContain("Loading guides");
  });

  it("renders a card per guide", () => {
    const wrapper = mount(GuidesList, {
      ...globalConfig,
      props: { ...BASE_PROPS, guides: SAMPLE_GUIDES },
    });
    expect(wrapper.findAll(".gcard")).toHaveLength(1);
  });

  it("shows the empty state once loaded with no guides", () => {
    const wrapper = mount(GuidesList, {
      ...globalConfig,
      props: BASE_PROPS,
    });
    expect(wrapper.text()).toContain("No guides yet");
  });

  it("shows neither state before the first load resolves", () => {
    const wrapper = mount(GuidesList, {
      ...globalConfig,
      props: { ...BASE_PROPS, hasLoaded: false },
    });
    expect(wrapper.text()).not.toContain("No guides yet");
    expect(wrapper.text()).not.toContain("Loading guides");
  });

  it("renders the edit form in place of the card being edited", () => {
    const wrapper = mount(GuidesList, {
      ...globalConfig,
      props: {
        ...BASE_PROPS,
        guides: SAMPLE_GUIDES,
        editingGuideId: "g-1",
      },
    });
    expect(wrapper.find(".guide-form").exists()).toBe(true);
    expect(wrapper.find(".gcard").exists()).toBe(false);
  });

  it("emits edit from the card", async () => {
    const wrapper = mount(GuidesList, {
      ...globalConfig,
      props: { ...BASE_PROPS, guides: SAMPLE_GUIDES },
    });

    await wrapper
      .findAll(".gcard__acts button")
      .find((button) => button.text() === "edit")
      ?.trigger("click");
    expect(wrapper.emitted("edit")?.[0]).toEqual([SAMPLE_GUIDES[0]]);
  });

  it("emits delete from the card once the delete is confirmed", async () => {
    const wrapper = mount(GuidesList, {
      ...globalConfig,
      props: { ...BASE_PROPS, guides: SAMPLE_GUIDES },
    });

    await wrapper
      .findAll(".gcard__acts button")
      .find((button) => button.text() === "delete")
      ?.trigger("click");
    await wrapper
      .findAll(".gcard__acts button")
      .find((button) => button.text() === "confirm delete")
      ?.trigger("click");

    expect(wrapper.emitted("delete")?.[0]).toEqual([SAMPLE_GUIDES[0]]);
  });

  it("emits toggle-like from the card's like button", async () => {
    const wrapper = mount(GuidesList, {
      ...globalConfig,
      props: { ...BASE_PROPS, guides: SAMPLE_GUIDES },
    });

    await wrapper.find(".gcard__like").trigger("click");

    expect(wrapper.emitted("toggle-like")?.[0]).toEqual([SAMPLE_GUIDES[0]]);
  });

  it("marks a card liked when its id is in likedGuideIds", () => {
    const wrapper = mount(GuidesList, {
      ...globalConfig,
      props: {
        ...BASE_PROPS,
        guides: SAMPLE_GUIDES,
        likedGuideIds: new Set([SAMPLE_GUIDES[0]!.id]),
      },
    });

    expect(wrapper.find(".gcard__like").classes()).toContain("liked");
  });

  it("emits submitEdit with the guide id and input from the edit form", async () => {
    const wrapper = mount(GuidesList, {
      ...globalConfig,
      props: {
        ...BASE_PROPS,
        guides: SAMPLE_GUIDES,
        editingGuideId: "g-1",
      },
    });

    await wrapper.find(".guide-form form").trigger("submit");

    const emitted = wrapper.emitted("submitEdit");
    expect(emitted?.[0]![0]).toBe("g-1");
    expect(emitted?.[0]![1]).toMatchObject({ title: "Tokyo on foot" });
  });

  it("emits cancelEdit when the edit form is cancelled", async () => {
    const wrapper = mount(GuidesList, {
      ...globalConfig,
      props: {
        ...BASE_PROPS,
        guides: SAMPLE_GUIDES,
        editingGuideId: "g-1",
      },
    });

    const cancelButton = wrapper
      .findAll(".guide-form button")
      .find((button) => button.text() === "cancel");
    await cancelButton?.trigger("click");

    expect(wrapper.emitted("cancelEdit")).toBeTruthy();
  });
});
