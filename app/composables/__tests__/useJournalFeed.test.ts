import { describe, it, expect } from "vitest";
import { ref } from "vue";
import {
  groupEntriesByDay,
  groupEntriesByTrip,
  filterEntriesWithPhotos,
  useJournalFeed,
  FEED_TABS,
} from "../useJournalFeed";
import type { Entry } from "~/stores/entries";
import type { Trip } from "~/stores/trips";

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: "entry-1",
    userId: "user-1",
    tripId: null,
    placeId: null,
    title: "Test entry",
    body: null,
    occurredAt: "2026-06-12T04:00:00.000Z",
    visibility: "private",
    weather: null,
    likeCount: 0,
    createdAt: "2026-06-12T04:00:00.000Z",
    updatedAt: "2026-06-12T04:00:00.000Z",
    photos: [],
    tags: [],
    ...overrides,
  };
}

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: "trip-1",
    userId: "user-1",
    name: "Iceland",
    status: "ongoing",
    startDate: null,
    endDate: null,
    coverImageId: null,
    distanceKm: null,
    visibility: "private",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("FEED_TABS", () => {
  it("exports the correct tab labels", () => {
    expect(FEED_TABS).toEqual(["Timeline", "By trip", "Photos"]);
  });
});

describe("groupEntriesByDay", () => {
  it("returns an empty array for an empty input", () => {
    expect(groupEntriesByDay([])).toEqual([]);
  });

  it("sets a stable UTC-based key on each group", () => {
    const entry = makeEntry({ occurredAt: "2026-06-12T23:00:00.000Z" });
    const groups = groupEntriesByDay([entry]);
    expect(groups[0]!.key).toBe("2026-06-12");
  });

  it("gives groups in different years distinct keys even with the same month/day", () => {
    const entries = [
      makeEntry({ id: "e-1", occurredAt: "2026-06-12T04:00:00.000Z" }),
      makeEntry({ id: "e-2", occurredAt: "2025-06-12T04:00:00.000Z" }),
    ];
    const groups = groupEntriesByDay(entries);
    expect(groups).toHaveLength(2);
    expect(groups[0]!.key).not.toBe(groups[1]!.key);
  });

  it("groups two entries on the same UTC day into one group", () => {
    const entries = [
      makeEntry({
        id: "e-1",
        occurredAt: "2026-06-12T04:00:00.000Z",
      }),
      makeEntry({
        id: "e-2",
        occurredAt: "2026-06-12T18:00:00.000Z",
      }),
    ];

    const groups = groupEntriesByDay(entries);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.entries).toHaveLength(2);
  });

  it("creates separate groups for entries on different days", () => {
    const entries = [
      makeEntry({ id: "e-1", occurredAt: "2026-06-12T04:00:00.000Z" }),
      makeEntry({ id: "e-2", occurredAt: "2026-06-08T18:00:00.000Z" }),
    ];

    const groups = groupEntriesByDay(entries);
    expect(groups).toHaveLength(2);
  });

  it("falls back to createdAt when occurredAt is null", () => {
    const entry = makeEntry({
      id: "e-1",
      occurredAt: null,
      createdAt: "2026-06-15T10:00:00.000Z",
    });

    const groups = groupEntriesByDay([entry]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.entries[0]!.id).toBe("e-1");
  });

  it("preserves entry order within a group", () => {
    const entries = [
      makeEntry({ id: "e-1", occurredAt: "2026-06-12T04:00:00.000Z" }),
      makeEntry({ id: "e-2", occurredAt: "2026-06-12T22:00:00.000Z" }),
    ];

    const groups = groupEntriesByDay(entries);
    expect(groups[0]!.entries[0]!.id).toBe("e-1");
    expect(groups[0]!.entries[1]!.id).toBe("e-2");
  });
});

describe("groupEntriesByTrip", () => {
  it("returns an empty array for no entries", () => {
    expect(groupEntriesByTrip([], [])).toEqual([]);
  });

  it("places entries without a tripId into a 'No trip' group", () => {
    const entry = makeEntry({ id: "e-1", tripId: null });
    const groups = groupEntriesByTrip([entry], []);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.tripName).toBe("No trip");
    expect(groups[0]!.trip).toBeNull();
  });

  it("groups entries by their associated trip", () => {
    const trip = makeTrip({ id: "trip-1", name: "Iceland" });
    const entries = [
      makeEntry({ id: "e-1", tripId: "trip-1" }),
      makeEntry({ id: "e-2", tripId: "trip-1" }),
    ];

    const groups = groupEntriesByTrip(entries, [trip]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.tripName).toBe("Iceland");
    expect(groups[0]!.entries).toHaveLength(2);
  });

  it("creates separate groups for entries on different trips", () => {
    const trip1 = makeTrip({ id: "trip-1", name: "Iceland" });
    const trip2 = makeTrip({ id: "trip-2", name: "Portugal" });
    const entries = [
      makeEntry({ id: "e-1", tripId: "trip-1" }),
      makeEntry({ id: "e-2", tripId: "trip-2" }),
    ];

    const groups = groupEntriesByTrip(entries, [trip1, trip2]);
    expect(groups).toHaveLength(2);
  });

  it("puts entries with an unknown tripId into the 'No trip' group", () => {
    const entry = makeEntry({ id: "e-1", tripId: "unknown-trip" });
    const groups = groupEntriesByTrip([entry], []);

    expect(groups[0]!.tripName).toBe("No trip");
  });

  it("appends the 'No trip' group after named trip groups", () => {
    const trip = makeTrip({ id: "trip-1", name: "Iceland" });
    const entries = [
      makeEntry({ id: "e-1", tripId: "trip-1" }),
      makeEntry({ id: "e-2", tripId: null }),
    ];

    const groups = groupEntriesByTrip(entries, [trip]);
    expect(groups[groups.length - 1]!.tripName).toBe("No trip");
  });
});

describe("filterEntriesWithPhotos", () => {
  it("returns an empty array when no entries have photos", () => {
    const entries = [makeEntry(), makeEntry({ id: "e-2" })];
    expect(filterEntriesWithPhotos(entries)).toHaveLength(0);
  });

  it("returns only entries that have at least one photo", () => {
    const withPhoto = makeEntry({
      id: "e-1",
      photos: [
        {
          id: "photo-1",
          entryId: "e-1",
          mediaId: "media-1",
          sortOrder: 0,
        },
      ],
    });
    const withoutPhoto = makeEntry({ id: "e-2" });

    const result = filterEntriesWithPhotos([withPhoto, withoutPhoto]);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("e-1");
  });
});

describe("useJournalFeed", () => {
  it("initializes activeTab to Timeline", () => {
    const entries = ref<Entry[]>([]);
    const { activeTab } = useJournalFeed(entries, ref([]));
    expect(activeTab.value).toBe("Timeline");
  });

  it("dayGroups is reactive to entries changes", () => {
    const entries = ref<Entry[]>([]);
    const { dayGroups } = useJournalFeed(entries, ref([]));

    expect(dayGroups.value).toHaveLength(0);

    entries.value = [makeEntry()];
    expect(dayGroups.value).toHaveLength(1);
  });

  it("tripGroups updates when entries change", () => {
    const entries = ref<Entry[]>([]);
    const trips = ref<Trip[]>([makeTrip({ id: "trip-1" })]);
    const { tripGroups } = useJournalFeed(entries, trips);

    expect(tripGroups.value).toHaveLength(0);

    entries.value = [makeEntry({ id: "e-1", tripId: "trip-1" })];
    expect(tripGroups.value).toHaveLength(1);
  });

  it("photoEntries filters entries with photos", () => {
    const entries = ref<Entry[]>([
      makeEntry({ id: "e-1" }),
      makeEntry({
        id: "e-2",
        photos: [{ id: "p-1", entryId: "e-2", mediaId: "m-1", sortOrder: 0 }],
      }),
    ]);
    const { photoEntries } = useJournalFeed(entries, ref([]));

    expect(photoEntries.value).toHaveLength(1);
    expect(photoEntries.value[0]!.id).toBe("e-2");
  });

  it("accepts a plain array for trips", () => {
    const entries = ref<Entry[]>([]);
    const trip = makeTrip({ id: "trip-1" });
    const { tripGroups } = useJournalFeed(entries, [trip]);

    entries.value = [makeEntry({ id: "e-1", tripId: "trip-1" })];
    expect(tripGroups.value).toHaveLength(1);
  });
});
