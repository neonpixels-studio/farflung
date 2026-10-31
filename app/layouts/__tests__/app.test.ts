import { describe, it, expect, vi, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h, inject } from "vue";
import AppLayout from "../app.vue";
import AppNotifications from "~/components/AppNotifications.vue";
import { useCommandPaletteShortcut } from "../../composables/useCommandPaletteShortcut";

// app.vue calls useCommandPaletteShortcut bare, relying on Nuxt's
// auto-import; plain Vitest has no auto-import, so it must be exposed as a
// global the same way vitest.setup.ts exposes useClerkAuth, useSearch, etc.
// The real implementation is used (not a mock) so these tests exercise the
// actual shortcut wiring.
vi.stubGlobal("useCommandPaletteShortcut", useCommandPaletteShortcut);

// Heavy children (real Clerk/store/composable usage) are stubbed with simple
// open/close mirrors so these tests exercise the layout's own wiring —
// mounting the command palette, providing openCommandPalette, and the
// global ⌘K/Ctrl+K shortcut — without depending on their internals.
const sidebarStub = defineComponent({
  name: "AppSidebarStub",
  props: ["isOpen"],
  emits: ["close"],
  template: '<div class="sidebar-stub" :data-open="isOpen" />',
});

const newEntryStub = defineComponent({
  name: "AppNewEntryStub",
  props: ["open", "entry"],
  emits: ["close"],
  template:
    '<div class="new-entry-stub" :data-open="open" :data-entry-id="entry ? entry.id : \'\'" />',
});

const notificationsStub = defineComponent({
  name: "AppNotificationsStub",
  props: ["open"],
  emits: ["close"],
  template: '<div class="notifications-stub" :data-open="open" />',
});

const commandPaletteStub = defineComponent({
  name: "AppCommandPaletteStub",
  props: ["open"],
  emits: ["close"],
  template: '<div class="command-palette-stub" :data-open="open" />',
});

// Stands in for a real page (home.vue, explore.vue) that injects
// openCommandPalette to wire its topbar search button.
const triggerHost = defineComponent({
  name: "TriggerHost",
  setup() {
    const openCommandPalette = inject<(() => void) | undefined>(
      "openCommandPalette",
      undefined,
    );
    return () =>
      h(
        "button",
        { class: "trigger", onClick: () => openCommandPalette?.() },
        "open",
      );
  },
});

function mountLayout() {
  return mount(AppLayout, {
    slots: { default: () => h(triggerHost) },
    global: {
      stubs: {
        AppSidebar: sidebarStub,
        AppNewEntry: newEntryStub,
        AppNotifications: notificationsStub,
        AppCommandPalette: commandPaletteStub,
      },
    },
  });
}

// Injects both entry-drawer openers so the test can drive the create/edit mode
// wiring the same way a page (journal.vue) does.
const entryHost = defineComponent({
  name: "EntryHost",
  setup() {
    const openEditEntry = inject<((entry: { id: string }) => void) | undefined>(
      "openEditEntry",
      undefined,
    );
    const openNewEntry = inject<(() => void) | undefined>(
      "openNewEntry",
      undefined,
    );
    return () =>
      h("div", [
        h(
          "button",
          { class: "edit", onClick: () => openEditEntry?.({ id: "entry-9" }) },
          "edit",
        ),
        h("button", { class: "new", onClick: () => openNewEntry?.() }, "new"),
      ]);
  },
});

function mountLayoutWithEntryHost() {
  return mount(AppLayout, {
    slots: { default: () => h(entryHost) },
    global: {
      stubs: {
        AppSidebar: sidebarStub,
        AppNewEntry: newEntryStub,
        AppNotifications: notificationsStub,
        AppCommandPalette: commandPaletteStub,
      },
    },
  });
}

describe("layouts/app.vue", () => {
  it("mounts the command palette closed by default", () => {
    const wrapper = mountLayout();
    expect(wrapper.find(".command-palette-stub").attributes("data-open")).toBe(
      "false",
    );
  });

  it("opens the command palette when a descendant calls the injected openCommandPalette", async () => {
    const wrapper = mountLayout();

    await wrapper.find(".trigger").trigger("click");

    expect(wrapper.find(".command-palette-stub").attributes("data-open")).toBe(
      "true",
    );
  });

  it("opens the command palette on the global ⌘K/Ctrl+K shortcut", async () => {
    const wrapper = mountLayout();

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true }),
    );
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".command-palette-stub").attributes("data-open")).toBe(
      "true",
    );
  });

  it("passes the entry to the drawer when openEditEntry is called", async () => {
    const wrapper = mountLayoutWithEntryHost();
    expect(wrapper.find(".new-entry-stub").attributes("data-entry-id")).toBe(
      "",
    );

    await wrapper.find(".edit").trigger("click");

    expect(wrapper.find(".new-entry-stub").attributes("data-open")).toBe(
      "true",
    );
    expect(wrapper.find(".new-entry-stub").attributes("data-entry-id")).toBe(
      "entry-9",
    );
  });

  it("clears edit mode when openNewEntry is called after an edit", async () => {
    const wrapper = mountLayoutWithEntryHost();
    await wrapper.find(".edit").trigger("click");

    await wrapper.find(".new").trigger("click");

    expect(wrapper.find(".new-entry-stub").attributes("data-open")).toBe(
      "true",
    );
    expect(wrapper.find(".new-entry-stub").attributes("data-entry-id")).toBe(
      "",
    );
  });

  it("clears edit mode when the drawer emits close", async () => {
    const wrapper = mountLayoutWithEntryHost();
    await wrapper.find(".edit").trigger("click");

    await wrapper.findComponent(newEntryStub).vm.$emit("close");
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".new-entry-stub").attributes("data-open")).toBe(
      "false",
    );
    expect(wrapper.find(".new-entry-stub").attributes("data-entry-id")).toBe(
      "",
    );
  });

  it("closes the command palette when it emits close", async () => {
    const wrapper = mountLayout();
    await wrapper.find(".trigger").trigger("click");

    await wrapper.findComponent(commandPaletteStub).vm.$emit("close");
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".command-palette-stub").attributes("data-open")).toBe(
      "false",
    );
  });

  describe("notifications bell", () => {
    // Real AppNotifications (not the stub) so the bell click and the panel's
    // document-level outside-click handler are exercised together.
    const bellHost = defineComponent({
      name: "BellHost",
      setup() {
        const toggleNotifications = inject<
          ((event: MouseEvent) => void) | undefined
        >("toggleNotifications", undefined);
        return () =>
          h(
            "button",
            {
              class: "bell",
              onClick: (event: MouseEvent) => toggleNotifications?.(event),
            },
            "bell",
          );
      },
    });

    let wrapper: ReturnType<typeof mount>;

    function mountWithRealNotifications() {
      wrapper = mount(AppLayout, {
        slots: { default: () => h(bellHost) },
        attachTo: document.body,
        global: {
          // Components are Nuxt auto-imports, so the real one must be registered.
          components: { AppNotifications },
          stubs: {
            AppSidebar: sidebarStub,
            AppNewEntry: newEntryStub,
            AppCommandPalette: commandPaletteStub,
            AppIcon: true,
            NuxtLink: { template: "<a><slot /></a>" },
          },
        },
      });
      return wrapper;
    }

    afterEach(() => {
      wrapper.unmount();
    });

    it("opens the notifications on the first bell click", async () => {
      mountWithRealNotifications();

      await wrapper.find(".bell").trigger("click");

      expect(wrapper.findComponent(AppNotifications).props("open")).toBe(true);
      expect(wrapper.find(".notif").exists()).toBe(true);
    });

    it("closes on a second bell click without the outside-click handler reopening it", async () => {
      mountWithRealNotifications();
      await wrapper.find(".bell").trigger("click");

      await wrapper.find(".bell").trigger("click");

      expect(wrapper.find(".notif").exists()).toBe(false);
    });

    it("closes on an outside click and reopens on the next bell click", async () => {
      mountWithRealNotifications();
      await wrapper.find(".bell").trigger("click");

      document.body.click();
      await wrapper.vm.$nextTick();
      expect(wrapper.find(".notif").exists()).toBe(false);

      await wrapper.find(".bell").trigger("click");
      expect(wrapper.find(".notif").exists()).toBe(true);
    });

    it("closes on Escape", async () => {
      mountWithRealNotifications();
      await wrapper.find(".bell").trigger("click");

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await wrapper.vm.$nextTick();

      expect(wrapper.find(".notif").exists()).toBe(false);
    });

    it("anchors the panel to the clicked bell", async () => {
      mountWithRealNotifications();

      await wrapper.find(".bell").trigger("click");

      expect(wrapper.findComponent(AppNotifications).props("anchor")).toBe(
        wrapper.find(".bell").element,
      );
    });
  });
});
