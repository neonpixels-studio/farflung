import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref, computed } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import TripsPage from "../trips/index.vue";
import { useTripsStore } from "~/stores/trips";
import type { Trip } from "~/stores/trips";
import { UNEXPECTED_ERROR_MESSAGE } from "~/utils/extractErrorMessage";

const mockTripsStats = ref({
  placesCount: 117,
  countriesCount: 9,
  totalDistanceMi: 48218,
  totalDistanceKm: 77600,
  currentStreak: 14,
  placesThisWeek: 6,
  distanceMiThisWeek: 1400,
  distanceKmThisWeek: 2254,
  distanceUnit: "mi",
});

vi.mock("~/composables/useStats", () => ({
  useStats: vi.fn(() => ({
    stats: mockTripsStats,
    displayDistance: computed(() => mockTripsStats.value.totalDistanceMi),
    displayDistanceDelta: computed(
      () => mockTripsStats.value.distanceMiThisWeek,
    ),
    displayDistanceLabel: computed(() => "Miles logged"),
    isLoading: ref(false),
    loadError: ref(null),
    fetchStats: vi.fn().mockResolvedValue(undefined),
  })),
}));

// The saved distance-unit preference useDistanceUnit reads. Each test sets it
// (and the signed-in flag) explicitly through these.
const mockPreferences = ref({ distanceUnit: "mi" });
const clerkSignedIn = ref(true);

vi.mock("~/composables/usePreferences", () => ({
  usePreferences: () => ({
    preferences: mockPreferences,
    hasLoaded: ref(true),
    fetchPreferences: vi.fn(),
  }),
}));

vi.stubGlobal("useClerkAuth", () => ({
  isSignedIn: clerkSignedIn,
  isLoaded: ref(true),
  getToken: vi.fn().mockResolvedValue(null),
}));

const SAMPLE_TRIPS: Trip[] = [
  {
    id: "1",
    userId: "user-1",
    name: "Iceland, the ring road",
    status: "ongoing",
    startDate: "2026-06-20T00:00:00.000Z",
    endDate: "2026-06-29T00:00:00.000Z",
    coverImageId: null,
    distanceKm: 892,
    visibility: "private",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "2",
    userId: "user-1",
    name: "Portugal, coast to coast",
    status: "upcoming",
    startDate: "2026-07-01T00:00:00.000Z",
    endDate: "2026-07-10T00:00:00.000Z",
    coverImageId: null,
    distanceKm: null,
    visibility: "private",
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  },
  {
    id: "3",
    userId: "user-1",
    name: "Norway in winter",
    status: "upcoming",
    startDate: null,
    endDate: null,
    coverImageId: null,
    distanceKm: null,
    visibility: "private",
    createdAt: "2026-01-03T00:00:00.000Z",
    updatedAt: "2026-01-03T00:00:00.000Z",
  },
  {
    id: "4",
    userId: "user-1",
    name: "Japan, north to south",
    status: "past",
    startDate: "2025-10-04T00:00:00.000Z",
    endDate: "2025-10-22T00:00:00.000Z",
    coverImageId: null,
    distanceKm: null,
    visibility: "private",
    createdAt: "2025-10-22T00:00:00.000Z",
    updatedAt: "2025-10-22T00:00:00.000Z",
  },
  {
    id: "5",
    userId: "user-1",
    name: "Marrakech & the Atlas",
    status: "past",
    startDate: "2025-03-12T00:00:00.000Z",
    endDate: "2025-03-19T00:00:00.000Z",
    coverImageId: null,
    distanceKm: null,
    visibility: "private",
    createdAt: "2025-03-19T00:00:00.000Z",
    updatedAt: "2025-03-19T00:00:00.000Z",
  },
  {
    id: "6",
    userId: "user-1",
    name: "Sydney & the east coast",
    status: "past",
    startDate: "2024-11-02T00:00:00.000Z",
    endDate: "2024-11-16T00:00:00.000Z",
    coverImageId: null,
    distanceKm: null,
    visibility: "private",
    createdAt: "2024-11-16T00:00:00.000Z",
    updatedAt: "2024-11-16T00:00:00.000Z",
  },
];

function buildGlobalConfig(pinia: ReturnType<typeof createPinia>) {
  return {
    global: {
      plugins: [pinia],
      stubs: {
        AppIcon: { template: "<svg data-icon />" },
        NuxtLink: {
          template: '<a :href="to"><slot /></a>',
          props: ["to"],
        },
      },
    },
  };
}

describe("Trips page (/trips)", () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    mockPreferences.value = { distanceUnit: "mi" };
    clerkSignedIn.value = true;

    const tripsStore = useTripsStore();
    tripsStore.tripList = [...SAMPLE_TRIPS];
    vi.spyOn(tripsStore, "fetchTrips").mockResolvedValue();
  });

  it("renders without crashing and matches snapshot", () => {
    const wrapper = mount(TripsPage, buildGlobalConfig(pinia));
    expect(wrapper.find(".trips-head").exists()).toBe(true);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("renders the featured active trip section", () => {
    const wrapper = mount(TripsPage, buildGlobalConfig(pinia));
    expect(wrapper.find(".feature").exists()).toBe(true);
  });

  it("renders 6 trips in the grid by default (All tab)", () => {
    const wrapper = mount(TripsPage, buildGlobalConfig(pinia));
    expect(wrapper.findAll(".tcard")).toHaveLength(6);
  });

  it("renders the tab filter", () => {
    const wrapper = mount(TripsPage, buildGlobalConfig(pinia));
    expect(wrapper.findAll(".seg-tabs button")).toHaveLength(4);
  });

  it("filters to upcoming trips when Upcoming tab is clicked", async () => {
    const wrapper = mount(TripsPage, buildGlobalConfig(pinia));
    const tabs = wrapper.findAll(".seg-tabs button");
    await tabs[2].trigger("click");
    expect(wrapper.findAll(".tcard")).toHaveLength(2);
  });

  it("filters to past trips when Past tab is clicked", async () => {
    const wrapper = mount(TripsPage, buildGlobalConfig(pinia));
    const tabs = wrapper.findAll(".seg-tabs button");
    await tabs[3].trigger("click");
    expect(wrapper.findAll(".tcard")).toHaveLength(3);
  });

  it("filters to ongoing trips when Ongoing tab is clicked", async () => {
    const wrapper = mount(TripsPage, buildGlobalConfig(pinia));
    const tabs = wrapper.findAll(".seg-tabs button");
    await tabs[1].trigger("click");
    expect(wrapper.findAll(".tcard")).toHaveLength(1);
  });

  it("shows ongoing status badge on active trip card", () => {
    const wrapper = mount(TripsPage, buildGlobalConfig(pinia));
    expect(wrapper.find(".tag--ongoing").exists()).toBe(true);
  });

  describe("trip distances follow the saved unit preference", () => {
    // SAMPLE_TRIPS[0] is 892 km, which is 554 mi.
    it("shows miles when the preference is miles", () => {
      mockPreferences.value = { distanceUnit: "mi" };
      const wrapper = mount(TripsPage, buildGlobalConfig(pinia));
      expect(wrapper.find(".feature").text()).toContain("554 mi");
      expect(wrapper.find(".feature").text()).not.toContain("892 km");
    });

    it("shows kilometres when the preference is kilometres", () => {
      mockPreferences.value = { distanceUnit: "km" };
      const wrapper = mount(TripsPage, buildGlobalConfig(pinia));
      expect(wrapper.find(".feature").text()).toContain("892 km");
      expect(wrapper.find(".feature").text()).not.toContain("554 mi");
    });

    // mockTripsStats reports "mi", so these prove the header reads the same
    // preference as the trip cards rather than the unit on the stats response.
    it("shows the header total in kilometres when the preference is kilometres", () => {
      mockPreferences.value = { distanceUnit: "km" };
      const wrapper = mount(TripsPage, buildGlobalConfig(pinia));
      const header = wrapper.find(".trips-head .label").text();
      expect(header).toContain("77.6k km");
      expect(header).not.toContain("miles");
    });

    it("shows the header total in miles when the preference is miles", () => {
      mockPreferences.value = { distanceUnit: "mi" };
      const wrapper = mount(TripsPage, buildGlobalConfig(pinia));
      const header = wrapper.find(".trips-head .label").text();
      expect(header).toContain("48.2k miles");
      expect(header).not.toContain(" km");
    });
  });

  it("shows the featured ongoing trip by name", () => {
    const wrapper = mount(TripsPage, buildGlobalConfig(pinia));
    const feature = wrapper.find(".feature");
    expect(feature.exists()).toBe(true);
    expect(feature.html()).toContain("Iceland, the ring road");
  });

  it("shows trip names from the store", () => {
    const wrapper = mount(TripsPage, buildGlobalConfig(pinia));
    expect(wrapper.html()).toContain("Iceland, the ring road");
    expect(wrapper.html()).toContain("Portugal, coast to coast");
  });

  it("shows formatted dates when trip has start and end dates", () => {
    const wrapper = mount(TripsPage, buildGlobalConfig(pinia));
    const cards = wrapper.findAll(".tcard__dates");
    // Trip 1 has dates so should not show "dates TBD"
    const tripWithDates = cards.find(
      (card) => !card.text().includes("dates TBD"),
    );
    expect(tripWithDates).toBeTruthy();
  });

  it("shows 'dates TBD' when trip has no start date", () => {
    const wrapper = mount(TripsPage, buildGlobalConfig(pinia));
    expect(wrapper.html()).toContain("dates TBD");
  });

  describe("subtitle", () => {
    it("derives the counts from the store's trips, not hard-coded text", () => {
      const wrapper = mount(TripsPage, buildGlobalConfig(pinia));

      expect(wrapper.find(".trips-head p").text()).toBe(
        "1 ongoing, 2 on the calendar, 3 in the books.",
      );
    });

    it("shows a neutral line instead of counts when there are no trips", () => {
      useTripsStore().tripList = [];

      const wrapper = mount(TripsPage, buildGlobalConfig(pinia));

      expect(wrapper.find(".trips-head p").text()).toBe(
        "Plan a route, log the journey, look back on it later.",
      );
    });
  });

  describe("empty state", () => {
    function mountWithTripState(state: {
      tripList?: Trip[];
      hasLoadedList?: boolean;
      isLoadingList?: boolean;
      listError?: string | null;
    }) {
      const tripsStore = useTripsStore();
      tripsStore.tripList = state.tripList ?? [];
      tripsStore.hasLoadedList = state.hasLoadedList ?? false;
      tripsStore.isLoadingList = state.isLoadingList ?? false;
      tripsStore.listError = state.listError ?? null;
      return mount(TripsPage, buildGlobalConfig(pinia));
    }

    it("tells the user to create a trip once loading finished with none", () => {
      const wrapper = mountWithTripState({ hasLoadedList: true });

      expect(wrapper.find(".empty-note").text()).toBe(
        "No trips yet, plan your first route above.",
      );
    });

    it("does not show before the first fetch has resolved", () => {
      const wrapper = mountWithTripState({ hasLoadedList: false });

      expect(wrapper.find(".empty-note").exists()).toBe(false);
    });

    it("does not show while a fetch is in flight", () => {
      const wrapper = mountWithTripState({
        hasLoadedList: true,
        isLoadingList: true,
      });

      expect(wrapper.find(".empty-note").exists()).toBe(false);
    });

    it("does not show when the fetch failed", () => {
      const wrapper = mountWithTripState({
        hasLoadedList: true,
        listError: "Something went wrong",
      });

      expect(wrapper.find(".empty-note").exists()).toBe(false);
    });

    it("does not show when there are trips", () => {
      const wrapper = mountWithTripState({
        tripList: [...SAMPLE_TRIPS],
        hasLoadedList: true,
      });

      expect(wrapper.find(".empty-note").exists()).toBe(false);
    });

    it("shows a filter message, not a create prompt, for a tab with no matches", async () => {
      const wrapper = mountWithTripState({
        tripList: SAMPLE_TRIPS.filter((trip) => trip.status !== "past"),
        hasLoadedList: true,
      });

      const pastTab = wrapper
        .findAll(".seg-tabs button")
        .find((button) => button.text() === "Past");
      await pastTab?.trigger("click");

      expect(wrapper.find(".empty-note").text()).toBe("No past trips yet.");
    });
  });

  it("calls fetchTrips on mount", async () => {
    const wrapper = mount(TripsPage, buildGlobalConfig(pinia));
    const tripsStore = useTripsStore();
    await wrapper.vm.$nextTick();
    expect(tripsStore.fetchTrips).toHaveBeenCalledTimes(1);
  });

  it("each trip card links to the correct trip detail route", () => {
    const wrapper = mount(TripsPage, buildGlobalConfig(pinia));
    const cards = wrapper.findAll(".tcard");
    cards.forEach((card, index) => {
      const expectedId = SAMPLE_TRIPS[index].id;
      expect(card.attributes("href")).toBe(`/trips/${expectedId}`);
    });
  });

  describe("plan a new route", () => {
    it("shows the new trip form when the button is clicked", async () => {
      const wrapper = mount(TripsPage, buildGlobalConfig(pinia));
      expect(wrapper.find(".new-trip-form").exists()).toBe(false);

      await wrapper.find(".trips-head button").trigger("click");

      expect(wrapper.find(".new-trip-form").exists()).toBe(true);
    });

    it("hides the form when cancel is clicked", async () => {
      const wrapper = mount(TripsPage, buildGlobalConfig(pinia));
      await wrapper.find(".trips-head button").trigger("click");

      const cancelButton = wrapper
        .findAll(".new-trip-form button")
        .find((button) => button.text().includes("cancel"));
      await cancelButton?.trigger("click");

      expect(wrapper.find(".new-trip-form").exists()).toBe(false);
    });

    it("creates a trip with the entered name and closes the form", async () => {
      const tripsStore = useTripsStore();
      const createdTrip: Trip = {
        ...SAMPLE_TRIPS[0],
        id: "new-trip-id",
        name: "Patagonia loop",
      };
      vi.spyOn(tripsStore, "createTrip").mockResolvedValue(createdTrip);

      const wrapper = mount(TripsPage, buildGlobalConfig(pinia));
      await wrapper.find(".trips-head button").trigger("click");
      await wrapper.find(".new-trip-form__input").setValue("Patagonia loop");
      await wrapper.find(".new-trip-form__row").trigger("submit");
      await flushPromises();

      expect(tripsStore.createTrip).toHaveBeenCalledWith({
        name: "Patagonia loop",
      });
      expect(wrapper.find(".new-trip-form").exists()).toBe(false);
    });

    it("does not submit when the name is blank", async () => {
      const tripsStore = useTripsStore();
      vi.spyOn(tripsStore, "createTrip").mockResolvedValue(SAMPLE_TRIPS[0]);

      const wrapper = mount(TripsPage, buildGlobalConfig(pinia));
      await wrapper.find(".trips-head button").trigger("click");
      await wrapper.find(".new-trip-form__row").trigger("submit");
      await flushPromises();

      expect(tripsStore.createTrip).not.toHaveBeenCalled();
      expect(wrapper.find(".new-trip-form").exists()).toBe(true);
    });

    it("shows an error message when trip creation fails", async () => {
      const tripsStore = useTripsStore();
      vi.spyOn(tripsStore, "createTrip").mockRejectedValue(
        new Error("Failed to create trip"),
      );

      const wrapper = mount(TripsPage, buildGlobalConfig(pinia));
      await wrapper.find(".trips-head button").trigger("click");
      await wrapper.find(".new-trip-form__input").setValue("Bad trip");
      await wrapper.find(".new-trip-form__row").trigger("submit");
      await flushPromises();

      // The raw Error's message is diagnostic text, not something the server
      // chose to surface — the generic fallback shows instead of leaking it
      // (see app/utils/extractErrorMessage.ts).
      expect(wrapper.find(".new-trip-form__error").text()).toBe(
        UNEXPECTED_ERROR_MESSAGE,
      );
      expect(wrapper.find(".new-trip-form").exists()).toBe(true);
    });
  });
});
