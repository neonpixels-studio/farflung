import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import ApiKeyCreatedDialog from "../ApiKeyCreatedDialog.vue";
import ApiKeyRow from "../ApiKeyRow.vue";
import ApiKeysSettings from "../ApiKeysSettings.vue";
import type { ApiKey } from "~/composables/useApiKeys";

const RAW_KEY = "ff_raw-secret-value";
const LISTED_KEY: ApiKey = {
  id: "key-1",
  name: "Backfill",
  prefix: "abcd1234",
  createdAt: "2026-01-15T12:00:00.000Z",
  lastUsedAt: null,
  expiresAt: null,
};

const apiKeys = ref<ApiKey[]>([]);
const actionError = ref<string | null>(null);
const fetchApiKeys = vi.fn();
const createApiKey = vi.fn();
const revokeApiKey = vi.fn();

vi.mock("~/composables/useApiKeys", () => ({
  useApiKeys: () => ({
    apiKeys,
    isLoading: ref(false),
    loadError: ref(null),
    actionError,
    fetchApiKeys,
    createApiKey,
    revokeApiKey,
  }),
}));

const inputStub = {
  props: ["modelValue", "label", "hint"],
  emits: ["update:modelValue"],
  template: `<label>{{ label }}<input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" /><small>{{ hint }}</small></label>`,
};

function mountSettings() {
  return mount(ApiKeysSettings, {
    global: {
      components: { ApiKeyCreatedDialog, ApiKeyRow },
      stubs: {
        AppIcon: true,
        InputText: inputStub,
        AppAlert: { props: ["title"], template: "<div>{{ title }}</div>" },
      },
    },
  });
}

async function submitForm(
  wrapper: ReturnType<typeof mountSettings>,
  name: string,
  days = "",
) {
  const inputs = wrapper.findAll("input");
  await inputs[0]?.setValue(name);
  await inputs[1]?.setValue(days);
  await wrapper.find("form").trigger("submit");
  await flushPromises();
}

describe("ApiKeysSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiKeys.value = [];
    actionError.value = null;
    createApiKey.mockResolvedValue({ ...LISTED_KEY, key: RAW_KEY });
    revokeApiKey.mockResolvedValue(undefined);
  });

  it("loads the keys on mount", () => {
    mountSettings();
    expect(fetchApiKeys).toHaveBeenCalledTimes(1);
  });

  it("lists prefix, created and last used, without any secret", () => {
    apiKeys.value = [
      { ...LISTED_KEY, lastUsedAt: "2026-02-20T12:00:00.000Z" },
      { ...LISTED_KEY, id: "key-2", name: "Unused" },
    ];

    const items = mountSettings().findAll(".api-key-row");

    expect(items).toHaveLength(2);
    expect(items[0]?.text()).toContain("ff_abcd1234…");
    expect(items[0]?.text()).toContain("Jan 15, 2026");
    expect(items[0]?.text()).toContain("Feb 20, 2026");
    expect(items[1]?.text()).toContain("Last used never");
  });

  it("shows the key once in a dialog that closing discards", async () => {
    const wrapper = mountSettings();

    await submitForm(wrapper, " Backfill ", "30");

    expect(createApiKey).toHaveBeenCalledWith({
      name: "Backfill",
      expiresInDays: 30,
    });
    expect(wrapper.find('[data-testid="api-key-secret"]').text()).toBe(RAW_KEY);

    const doneButton = wrapper
      .findAll(".api-key-dialog__actions button")
      .find((button) => button.text() === "done");
    await doneButton?.trigger("click");

    expect(wrapper.text()).not.toContain(RAW_KEY);
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it("omits expiresInDays when left blank", async () => {
    await submitForm(mountSettings(), "Forever");

    expect(createApiKey).toHaveBeenCalledWith({ name: "Forever" });
  });

  it.each([
    ["a blank name", "  ", "", "Name is required"],
    ["fractional days", "Key", "1.5", "whole number"],
    ["zero days", "Key", "0", "whole number"],
  ])("blocks %s", async (_label, name, days, message) => {
    const wrapper = mountSettings();

    await submitForm(wrapper, name, days);

    expect(createApiKey).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain(message);
  });

  it("opens no dialog when creation fails", async () => {
    createApiKey.mockResolvedValue(null);
    const wrapper = mountSettings();

    await submitForm(wrapper, "Sixth");

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it("copies the key, and tells the user when that fails", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const wrapper = mountSettings();
    await submitForm(wrapper, "Backfill");
    const copyButton = wrapper
      .findAll(".api-key-dialog__actions button")
      .find((button) => button.text() === "copy");

    await copyButton?.trigger("click");
    await flushPromises();
    expect(writeText).toHaveBeenCalledWith(RAW_KEY);
    expect(wrapper.text()).toContain("Copied.");

    writeText.mockRejectedValue(new Error("denied"));
    await copyButton?.trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("Couldn't copy");
    vi.unstubAllGlobals();
  });

  it("revokes only after a second, confirming click", async () => {
    apiKeys.value = [LISTED_KEY];
    const wrapper = mountSettings();
    const revokeButton = wrapper.find(".api-key-row button");

    await revokeButton.trigger("click");
    expect(revokeApiKey).not.toHaveBeenCalled();
    expect(revokeButton.text()).toBe("confirm revoke");

    await revokeButton.trigger("click");
    expect(revokeApiKey).toHaveBeenCalledWith("key-1");
  });
});
