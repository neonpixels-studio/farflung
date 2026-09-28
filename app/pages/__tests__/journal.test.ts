import { describe, it, expect, vi, beforeEach } from "vitest";
import { reactive } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import JournalPage from "../journal.vue";
import { useEntriesStore } from "~/stores/entries";
import { useTripsStore } from "~/stores/trips";
import type { Entry } from "~/stores/entries";
import type { Trip } from "~/stores/trips";

// Reactive so a test can set tag/tagName before mount to exercise the
// "pre-apply a tag filter from the route" path (see useSearch's mapTag,
// which links a Tags search result to /journal?tag=<id>&tagName=<name>), and
// so the page's own router.replace calls (below) drive the same watcher a
// real Nuxt navigation would. Reset in beforeEach so it doesn't leak between
// tests.
const routeQuery = reactive<Record<string, string>>({});
vi.stubGlobal("useRoute", () => ({ params: {}, query: routeQuery }));

// Mimics real Vue Router: replaces routeQuery's contents with the new query,
// so the page's `watch(() => route.query[...], ...)` actually fires — a bare
// vi.fn() no-op would leave the tag filter watcher untriggered and every
// filter test would be exercising dead code.
const mockRouterReplace = vi.fn((to: { query?: Record<string, string> }) => {
  for (const key of Object.keys(routeQuery)) {
    delete routeQuery[key];
  }
  Object.assign(routeQuery, to?.query ?? {});
});
vi.stubGlobal("useRouter", () => ({
  push: vi.fn(),
  replace: mockRouterReplace,
}));

const SAMPLE_ENTRIES: Entry[] = [
  {
    id: "entry-1",
    userId: "user-1",
    tripId: "trip-1",
    placeId: null,
    title: "Harbor at 4am",
    body: "Cold morning, the whole harbor still asleep.",
    occurredAt: "2026-06-12T04:12:00.000Z",
    visibility: "private",
    weather: null,
    likeCount: 24,
    createdAt: "2026-06-12T04:12:00.000Z",
    updatedAt: "2026-06-12T04:12:00.000Z",
    photos: [],
    tags: [{ id: "tag-1", name: "iceland" }],
  },
  {
    id: "entry-2",
    userId: "user-1",
    tripId: null,
    placeId: null,
    title: "Tram 28, again",
    body: "Took the long way through Alfama.",
    occurredAt: "2026-06-08T18:40:00.000Z",
    visibility: "private",
    weather: null,
    likeCount: 41,
    createdAt: "2026-06-08T18:40:00.000Z",
    updatedAt: "2026-06-08T18:40:00.000Z",
    photos: [],
    tags: [{ id: "tag-2", name: "portugal" }],
  },
];

const SAMPLE_TRIPS: Trip[] = [
  {
    id: "trip-1",
    userId: "user-1",
    name: "Iceland, the ring road",
    status: "ongoing",
    startDate: "2026-06-07T00:00:00.000Z",
    endDate: "2026-06-16T00:00:00.000Z",
    coverImageId: null,
    distanceKm: 892,
    visibility: "private",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "trip-2",
    userId: "user-1",
    name: "Portugal 2026",
    status: "past",
    startDate: "2026-06-01T00:00:00.000Z",
    endDate: "2026-06-10T00:00:00.000Z",
    coverImageId: null,
    distanceKm: null,
    visibility: "private",
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  },
];

function buildGlobalConfig(pinia: ReturnType<typeof createPinia>) {
  return {
    global: {
      plugins: [pinia],
      stubs: {
        AppIcon: { template: "<svg data-icon />" },
        AppTopbar: {
          template: '<header class="topbar"><slot /></header>',
          props: ["title", "crumb"],
        },
        NuxtLink: {
          template: '<a :href="to"><slot /></a>',
          props: ["to"],
        },
        JournalEntry: {
          template:
            '<article class="post"><h3 class="post__title">{{ entry.title }}</h3><button class="like" :class="{ liked: isLiked }" @click="$emit(\'toggle-like\', entry)"><span class="cnt">{{ entry.likeCount }}</span></button><button class="post__edit" @click="$emit(\'edit\', entry)" /><button v-for="tag in entry.tags" :key="tag.id" class="stub-tag" @click="$emit(\'filter-tag\', tag)">{{ tag.name }}</button></article>',
          props: ["entry", "isLiked"],
          emits: ["toggle-like", "edit", "filter-tag"],
        },
      },
    },
  };
}

describe("Journal page (/journal)", () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    for (const key of Object.keys(routeQuery)) {
      delete routeQuery[key];
    }
    mockRouterReplace.mockClear();

    pinia = createPinia();
    setActivePinia(pinia);

    const entriesStore = useEntriesStore();
    entriesStore.entries = [...SAMPLE_ENTRIES];
    vi.spyOn(entriesStore, "fetchEntries").mockResolvedValue();
    vi.spyOn(entriesStore, "fetchEntriesByTag").mockResolvedValue([]);
    vi.spyOn(entriesStore, "likeEntry").mockResolvedValue({
      ...SAMPLE_ENTRIES[0],
      likeCount: 25,
    });
    vi.spyOn(entriesStore, "unlikeEntry").mockResolvedValue({
      ...SAMPLE_ENTRIES[0],
      likeCount: 23,
    });

    const tripsStore = useTripsStore();
    tripsStore.tripList = [...SAMPLE_TRIPS];
    vi.spyOn(tripsStore, "fetchTrips").mockResolvedValue();
  });

  it("renders without crashing and matches snapshot", () => {
    const wrapper = mount(JournalPage, buildGlobalConfig(pinia));
    expect(wrapper.find(".feed").exists()).toBe(true);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("renders 3 feed tabs", () => {
    const wrapper = mount(JournalPage, buildGlobalConfig(pinia));
    expect(wrapper.findAll(".feed-tabs button")).toHaveLength(3);
    expect(wrapper.find(".feed-tabs button.is-active").text()).toBe("Timeline");
  });

  it("switches active tab when clicked", async () => {
    const wrapper = mount(JournalPage, buildGlobalConfig(pinia));
    const tabs = wrapper.findAll(".feed-tabs button");
    await tabs[1].trigger("click");
    expect(tabs[1].classes()).toContain("is-active");
    expect(tabs[0].classes()).not.toContain("is-active");
  });

  it("renders the compose bar", () => {
    const wrapper = mount(JournalPage, buildGlobalConfig(pinia));
    expect(wrapper.find(".compose").exists()).toBe(true);
    expect(wrapper.find(".compose input").exists()).toBe(true);
  });

  it("renders day dividers for timeline tab", () => {
    const wrapper = mount(JournalPage, buildGlobalConfig(pinia));
    // Two entries on different days → two day dividers
    expect(wrapper.findAll(".day-div")).toHaveLength(2);
  });

  it("renders post cards for each entry", () => {
    const wrapper = mount(JournalPage, buildGlobalConfig(pinia));
    expect(wrapper.findAll(".post")).toHaveLength(SAMPLE_ENTRIES.length);
  });

  it("renders entry titles from the store", () => {
    const wrapper = mount(JournalPage, buildGlobalConfig(pinia));
    const titles = wrapper.findAll(".post__title").map((el) => el.text());
    expect(titles).toContain("Harbor at 4am");
    expect(titles).toContain("Tram 28, again");
  });

  it("renders likeCount from the store", () => {
    const wrapper = mount(JournalPage, buildGlobalConfig(pinia));
    const counts = wrapper.findAll(".cnt").map((el) => el.text());
    expect(counts).toContain("24");
    expect(counts).toContain("41");
  });

  it("calls likeEntry on the store when like is toggled on an unliked entry", async () => {
    const entriesStore = useEntriesStore();
    const wrapper = mount(JournalPage, buildGlobalConfig(pinia));
    const likeBtn = wrapper.findAll(".like")[0];
    await likeBtn.trigger("click");
    expect(entriesStore.likeEntry).toHaveBeenCalledWith(SAMPLE_ENTRIES[0].id);
  });

  it("calls unlikeEntry on the store when like is toggled on an already-liked entry", async () => {
    const entriesStore = useEntriesStore();
    const wrapper = mount(JournalPage, buildGlobalConfig(pinia));
    // First click likes it
    const likeBtn = wrapper.findAll(".like")[0];
    await likeBtn.trigger("click");
    // Second click unlikes it
    await likeBtn.trigger("click");
    expect(entriesStore.unlikeEntry).toHaveBeenCalledWith(SAMPLE_ENTRIES[0].id);
  });

  it("invokes the injected openEditEntry with the entry when an entry's edit is triggered", async () => {
    const openEditEntry = vi.fn();
    const config = buildGlobalConfig(pinia);
    const wrapper = mount(JournalPage, {
      global: {
        ...config.global,
        provide: { openEditEntry },
      },
    });

    await wrapper.findAll(".post__edit")[0].trigger("click");

    expect(openEditEntry).toHaveBeenCalledWith(SAMPLE_ENTRIES[0]);
  });

  it("renders the right rail with active trip card", () => {
    const wrapper = mount(JournalPage, buildGlobalConfig(pinia));
    expect(wrapper.find(".rail").exists()).toBe(true);
    expect(wrapper.find(".rail-card .display").text()).toContain("Active trip");
  });

  it("shows the active trip name in the rail card", () => {
    const wrapper = mount(JournalPage, buildGlobalConfig(pinia));
    expect(wrapper.find(".rail").html()).toContain("Iceland, the ring road");
  });

  it("renders trip pills from the trips store", () => {
    const wrapper = mount(JournalPage, buildGlobalConfig(pinia));
    expect(wrapper.findAll(".trip-pill")).toHaveLength(SAMPLE_TRIPS.length);
  });

  it("hides on-this-day block when there are no matching entries", () => {
    const wrapper = mount(JournalPage, buildGlobalConfig(pinia));
    // onThisDayEntries starts empty; the API call on mount is not awaited in this sync test
    expect(wrapper.find(".onthisday").exists()).toBe(false);
  });

  it("renders By trip groups when By trip tab is active", async () => {
    const wrapper = mount(JournalPage, buildGlobalConfig(pinia));
    const tabs = wrapper.findAll(".feed-tabs button");
    await tabs[1].trigger("click");
    const dayDivs = wrapper.findAll(".day-div");
    // entry-1 belongs to trip-1; entry-2 has no trip → "No trip"
    expect(dayDivs.length).toBeGreaterThanOrEqual(1);
  });

  it("renders Photos tab with empty state when no photos", async () => {
    const wrapper = mount(JournalPage, buildGlobalConfig(pinia));
    const tabs = wrapper.findAll(".feed-tabs button");
    await tabs[2].trigger("click");
    expect(wrapper.find(".photo-grid").exists()).toBe(false);
    expect(wrapper.html()).toContain("no photos yet");
  });

  it("calls fetchEntries on mount", async () => {
    const entriesStore = useEntriesStore();
    mount(JournalPage, buildGlobalConfig(pinia));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(entriesStore.fetchEntries).toHaveBeenCalledTimes(1);
  });

  it("calls fetchTrips on mount", async () => {
    const tripsStore = useTripsStore();
    mount(JournalPage, buildGlobalConfig(pinia));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(tripsStore.fetchTrips).toHaveBeenCalledTimes(1);
  });

  describe("tag filter", () => {
    it("fetches and shows only entries for that tag when a tag is clicked", async () => {
      const entriesStore = useEntriesStore();
      vi.spyOn(entriesStore, "fetchEntriesByTag").mockResolvedValue([
        SAMPLE_ENTRIES[0],
      ]);
      const wrapper = mount(JournalPage, buildGlobalConfig(pinia));

      await wrapper.find(".stub-tag").trigger("click");
      await flushPromises();

      expect(entriesStore.fetchEntriesByTag).toHaveBeenCalledWith("tag-1");
      expect(wrapper.find(".tag-filter-bar").text()).toContain("iceland");
      // Only the tag-filtered result shows — the normal tab content is hidden.
      expect(wrapper.findAll(".post")).toHaveLength(1);
      expect(wrapper.find(".post__title").text()).toBe("Harbor at 4am");
    });

    it("picks up a tagged entry once the main store loads it, without needing to re-fetch", async () => {
      // Simulates a deep link (e.g. from a Tags search result) where the
      // tag-filter fetch resolves before the page's own fetchEntries() has.
      // taggedEntries is sourced from entriesStore.entries, so the entry
      // isn't rendered yet — but it appears automatically (no re-fetch) once
      // the store catches up, since the list is a computed over the store.
      const entriesStore = useEntriesStore();
      entriesStore.entries = [];
      vi.spyOn(entriesStore, "fetchEntriesByTag").mockResolvedValue([
        SAMPLE_ENTRIES[0],
      ]);

      routeQuery.tag = "tag-1";
      routeQuery.tagName = "iceland";
      const wrapper = mount(JournalPage, buildGlobalConfig(pinia));
      await flushPromises();

      expect(wrapper.find(".tag-filter-bar").exists()).toBe(true);
      expect(wrapper.findAll(".post")).toHaveLength(0);

      entriesStore.entries = [SAMPLE_ENTRIES[0]];
      await wrapper.vm.$nextTick();

      expect(wrapper.findAll(".post")).toHaveLength(1);
      expect(wrapper.find(".post__title").text()).toBe("Harbor at 4am");
    });

    it("drops an entry from the tag view once it's deleted from the store", async () => {
      const entriesStore = useEntriesStore();
      vi.spyOn(entriesStore, "fetchEntriesByTag").mockResolvedValue([
        SAMPLE_ENTRIES[0],
      ]);
      const wrapper = mount(JournalPage, buildGlobalConfig(pinia));

      await wrapper.find(".stub-tag").trigger("click");
      await flushPromises();
      expect(wrapper.findAll(".post")).toHaveLength(1);

      entriesStore.entries = entriesStore.entries.filter(
        (entry) => entry.id !== SAMPLE_ENTRIES[0].id,
      );
      await wrapper.vm.$nextTick();

      expect(wrapper.findAll(".post")).toHaveLength(0);
    });

    it("drops an entry from the tag view once its tag is removed via edit", async () => {
      const entriesStore = useEntriesStore();
      vi.spyOn(entriesStore, "fetchEntriesByTag").mockResolvedValue([
        SAMPLE_ENTRIES[0],
      ]);
      const wrapper = mount(JournalPage, buildGlobalConfig(pinia));

      await wrapper.find(".stub-tag").trigger("click");
      await flushPromises();
      expect(wrapper.findAll(".post")).toHaveLength(1);

      entriesStore.entries = entriesStore.entries.map((entry) =>
        entry.id === SAMPLE_ENTRIES[0].id ? { ...entry, tags: [] } : entry,
      );
      await wrapper.vm.$nextTick();

      expect(wrapper.findAll(".post")).toHaveLength(0);
    });

    it("clears the filter and restores the active tab when the clear button is clicked", async () => {
      const entriesStore = useEntriesStore();
      vi.spyOn(entriesStore, "fetchEntriesByTag").mockResolvedValue([
        SAMPLE_ENTRIES[0],
      ]);
      const wrapper = mount(JournalPage, buildGlobalConfig(pinia));

      await wrapper.find(".stub-tag").trigger("click");
      await flushPromises();
      expect(wrapper.find(".tag-filter-bar").exists()).toBe(true);

      await wrapper
        .find('button[aria-label="Clear tag filter"]')
        .trigger("click");

      expect(wrapper.find(".tag-filter-bar").exists()).toBe(false);
      expect(wrapper.findAll(".post")).toHaveLength(SAMPLE_ENTRIES.length);
    });

    it("clears the filter when switching tabs", async () => {
      const entriesStore = useEntriesStore();
      vi.spyOn(entriesStore, "fetchEntriesByTag").mockResolvedValue([
        SAMPLE_ENTRIES[0],
      ]);
      const wrapper = mount(JournalPage, buildGlobalConfig(pinia));

      await wrapper.find(".stub-tag").trigger("click");
      await flushPromises();
      expect(wrapper.find(".tag-filter-bar").exists()).toBe(true);

      const tabs = wrapper.findAll(".feed-tabs button");
      await tabs[1].trigger("click");

      expect(wrapper.find(".tag-filter-bar").exists()).toBe(false);
      expect(tabs[1].classes()).toContain("is-active");
    });

    it("pre-applies a tag filter from the route query on mount", async () => {
      routeQuery.tag = "tag-2";
      routeQuery.tagName = "portugal";
      const entriesStore = useEntriesStore();
      vi.spyOn(entriesStore, "fetchEntriesByTag").mockResolvedValue([
        SAMPLE_ENTRIES[1],
      ]);

      const wrapper = mount(JournalPage, buildGlobalConfig(pinia));
      await flushPromises();

      expect(entriesStore.fetchEntriesByTag).toHaveBeenCalledWith("tag-2");
      expect(wrapper.find(".tag-filter-bar").text()).toContain("portugal");
    });

    it("applies the filter from an id-only route query (no tagName)", async () => {
      routeQuery.tag = "tag-2";
      const entriesStore = useEntriesStore();
      vi.spyOn(entriesStore, "fetchEntriesByTag").mockResolvedValue([
        SAMPLE_ENTRIES[1],
      ]);

      const wrapper = mount(JournalPage, buildGlobalConfig(pinia));
      await flushPromises();

      expect(entriesStore.fetchEntriesByTag).toHaveBeenCalledWith("tag-2");
      // The real tag name is resolved from the fetched entries even though
      // the URL never carried one.
      expect(wrapper.find(".tag-filter-bar").text()).toContain("portugal");
    });

    it("does not re-fetch when only tagName changes for the same tag id", async () => {
      routeQuery.tag = "tag-1";
      routeQuery.tagName = "iceland";
      const entriesStore = useEntriesStore();
      vi.spyOn(entriesStore, "fetchEntriesByTag").mockResolvedValue([
        SAMPLE_ENTRIES[0],
      ]);

      mount(JournalPage, buildGlobalConfig(pinia));
      await flushPromises();
      expect(entriesStore.fetchEntriesByTag).toHaveBeenCalledTimes(1);

      routeQuery.tagName = "Iceland";
      await flushPromises();

      expect(entriesStore.fetchEntriesByTag).toHaveBeenCalledTimes(1);
    });

    it("does not apply a tag filter when the route query is absent", async () => {
      const entriesStore = useEntriesStore();
      const wrapper = mount(JournalPage, buildGlobalConfig(pinia));
      await flushPromises();

      expect(entriesStore.fetchEntriesByTag).not.toHaveBeenCalled();
      expect(wrapper.find(".tag-filter-bar").exists()).toBe(false);
    });

    it("writes tag/tagName onto the URL when a tag is clicked, and removes them on clear", async () => {
      const entriesStore = useEntriesStore();
      vi.spyOn(entriesStore, "fetchEntriesByTag").mockResolvedValue([
        SAMPLE_ENTRIES[0],
      ]);
      const wrapper = mount(JournalPage, buildGlobalConfig(pinia));

      await wrapper.find(".stub-tag").trigger("click");
      await flushPromises();

      expect(mockRouterReplace).toHaveBeenCalledWith({
        query: expect.objectContaining({ tag: "tag-1", tagName: "iceland" }),
      });

      await wrapper
        .find('button[aria-label="Clear tag filter"]')
        .trigger("click");

      expect(routeQuery.tag).toBeUndefined();
      expect(routeQuery.tagName).toBeUndefined();
    });

    it("ignores a slower response for a tag that's since been superseded by a second filter change", async () => {
      const entriesStore = useEntriesStore();
      let resolveFirst!: (entries: Entry[]) => void;
      const firstFetch = new Promise<Entry[]>((resolve) => {
        resolveFirst = resolve;
      });
      const fetchEntriesByTagSpy = vi
        .spyOn(entriesStore, "fetchEntriesByTag")
        .mockImplementationOnce(() => firstFetch)
        .mockResolvedValueOnce([SAMPLE_ENTRIES[1]]);

      const wrapper = mount(JournalPage, buildGlobalConfig(pinia));

      // Two route changes in quick succession — e.g. a click on tag A whose
      // request is still in flight when a second click (tag B) lands first.
      // mockRouterReplace mutates routeQuery synchronously, driving the same
      // watcher a real navigation would.
      mockRouterReplace({ query: { tag: "tag-1", tagName: "iceland" } });
      await flushPromises();
      mockRouterReplace({ query: { tag: "tag-2", tagName: "portugal" } });
      await flushPromises();

      expect(fetchEntriesByTagSpy).toHaveBeenNthCalledWith(1, "tag-1");
      expect(fetchEntriesByTagSpy).toHaveBeenNthCalledWith(2, "tag-2");
      expect(wrapper.find(".tag-filter-bar").text()).toContain("portugal");
      expect(wrapper.find(".post__title").text()).toBe("Tram 28, again");

      // The stale first request now resolves — it must not clobber the
      // second (current) filter's result.
      resolveFirst([SAMPLE_ENTRIES[0]]);
      await flushPromises();

      expect(wrapper.find(".tag-filter-bar").text()).toContain("portugal");
      expect(wrapper.find(".post__title").text()).toBe("Tram 28, again");
    });

    it("shows an error state (not an empty state) when the tag fetch fails", async () => {
      const entriesStore = useEntriesStore();
      vi.spyOn(entriesStore, "fetchEntriesByTag").mockRejectedValue(
        new Error("Network error"),
      );
      const wrapper = mount(JournalPage, buildGlobalConfig(pinia));

      await wrapper.find(".stub-tag").trigger("click");
      await flushPromises();

      expect(wrapper.html()).not.toContain("no entries with this tag");
      expect(wrapper.find('[role="alert"]').exists()).toBe(true);
      // The shared store error must stay untouched — the main tab views must
      // not inherit a failure that belongs to the tag-filtered view.
      expect(entriesStore.error).toBeNull();
    });
  });
});
