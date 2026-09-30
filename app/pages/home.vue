<template>
  <div class="content content--wide">
    <AppTopbar title="Dashboard" crumb="Home">
      <button
        class="icon-btn"
        aria-label="Search"
        @click="openCommandPalette?.()"
      >
        <AppIcon name="search" :size="18" />
      </button>
      <button
        class="icon-btn"
        aria-label="Alerts"
        @click="openNotifications?.()"
      >
        <AppIcon name="bell" :size="18" />
      </button>
      <button class="btn btn--primary btn--sm" @click="openNewEntry?.()">
        <AppIcon name="plus" :size="14" />
        new entry
      </button>
    </AppTopbar>

    <!-- Greeting -->
    <div class="hello">
      <div>
        <div class="label">// {{ timeOfDayLabel }} · {{ localDateLabel }}</div>
        <h1 style="margin-top: 10px">
          Welcome back, <b>{{ displayName }}.</b>
        </h1>
        <p>
          You've been to {{ rawStats.countriesCount }} countries.
          <template v-if="ongoingTrip">
            {{ ongoingTrip.name }} is your current trip.
          </template>
        </p>
      </div>
      <NuxtLink class="btn btn--outline" to="/map">
        <AppIcon name="map" :size="16" />
        open the map
      </NuxtLink>
    </div>

    <!-- Import alert: only show when Instagram is connected -->
    <div
      v-if="showImportAlert"
      class="alert alert--info"
      style="margin-bottom: 22px"
    >
      <AppIcon name="instagram" :size="18" class="alert__ico" />
      <div class="alert__body">
        <p class="alert__title">
          <template v-if="importError"
            >Import failed: {{ importError }}</template
          >
          <template v-else-if="importResult">
            {{ importResult.imported }} photo{{
              importResult.imported === 1 ? "" : "s"
            }}
            imported
            <template v-if="importResult.skipped > 0"
              >, {{ importResult.skipped }} skipped</template
            >
          </template>
          <template v-else>Geotagged photos from Instagram are ready</template>
        </p>
        <p class="alert__msg">
          Import them straight into your journal entries.
        </p>
      </div>
      <div class="hstack gap-8" style="margin-left: auto">
        <NuxtLink class="btn btn--ghost btn--sm" to="/settings#connections"
          >manage</NuxtLink
        >
        <button
          class="btn btn--primary btn--sm"
          :disabled="isImporting"
          @click="handleImportAll"
        >
          {{ isImporting ? "importing…" : "import all" }}
        </button>
        <button
          class="icon-btn"
          aria-label="Dismiss import alert"
          @click="dismissImportAlert"
        >
          <AppIcon name="x" :size="14" />
        </button>
      </div>
    </div>

    <!-- Stats load error -->
    <div
      v-if="statsError"
      class="alert alert--error"
      role="alert"
      style="margin-bottom: 14px"
    >
      {{ statsError }}
    </div>

    <!-- Stats -->
    <div class="stats">
      <div v-for="stat in stats" :key="stat.label" class="stat">
        <div class="stat__ico">
          <AppIcon :name="stat.icon" :size="16" />
        </div>
        <div class="stat__num">{{ stat.value }}</div>
        <div class="stat__lbl">{{ stat.label }}</div>
        <div v-if="stat.delta" class="stat__delta">{{ stat.delta }}</div>
      </div>
    </div>

    <!-- Map + current trip -->
    <div class="cols">
      <div class="map-card">
        <div class="map-card__bar">
          <span class="label label--plain" style="color: var(--ink)"
            >Your world</span
          >
          <span class="grow" />
          <span class="tag"
            >{{ formatCompact(rawStats.placesCount) }} pins</span
          >
          <NuxtLink class="btn btn--ghost btn--sm" to="/map">
            expand
            <AppIcon name="arrow-right" :size="14" />
          </NuxtLink>
        </div>
        <div class="map-body">
          <div class="map-panel">
            <div class="topo" style="opacity: 0.4" />
          </div>
          <NuxtLink
            v-for="pin in mapPins"
            :key="pin.tip"
            class="pin-abs"
            :class="{ sm: pin.sm }"
            to="/journal"
            :style="{ left: pin.left, top: pin.top }"
          >
            <AppIcon name="pin" :size="pin.sm ? 17 : 24" class="pin" />
            <span class="pin-tip">{{ pin.tip }}</span>
          </NuxtLink>
        </div>
      </div>

      <!-- Current trip card -->
      <div class="trip-card">
        <div class="label">// current trip</div>
        <template v-if="ongoingTrip">
          <div class="trip-hero ph" style="margin-top: 12px">
            <div class="topo" style="opacity: 0.5" />
            <span class="ph__tag" style="position: relative; z-index: 2"
              >cover · {{ ongoingTrip.name.toLowerCase() }}</span
            >
          </div>
          <h3 style="font-size: 18px">{{ ongoingTrip.name }}</h3>
          <p class="muted" style="font-size: 12px; margin: 4px 0 0">
            {{ tripDayLabel }} · {{ tripStopsLabel }}
          </p>
          <div class="progress">
            <span :style="{ width: tripProgressPercent + '%' }" />
          </div>
          <div
            class="hstack"
            style="
              justify-content: space-between;
              font-size: 11px;
              color: var(--muted);
            "
          >
            <span>{{ tripProgressPercent }}% logged</span>
            <span>{{ tripDaysRemainingLabel }}</span>
          </div>
          <div v-if="tripNextStop" class="nextstop">
            <AppIcon name="pin" :size="18" style="color: var(--accent)" />
            <div>
              <div style="font-size: 12.5px; font-weight: 600">
                Next: {{ tripNextStop.name }}
              </div>
              <div
                v-if="tripNextStop.note"
                style="font-size: 11px; color: var(--muted)"
              >
                {{ tripNextStop.note }}
              </div>
            </div>
          </div>
        </template>
        <template v-else>
          <div class="trip-hero ph" style="margin-top: 12px">
            <div class="topo" style="opacity: 0.5" />
          </div>
          <p class="muted" style="font-size: 12px; margin: 4px 0 0">
            No active trip right now.
          </p>
          <NuxtLink
            class="btn btn--outline btn--sm"
            to="/trips"
            style="margin-top: 12px"
          >
            <AppIcon name="route" :size="14" />
            browse trips
          </NuxtLink>
        </template>
      </div>
    </div>

    <!-- Recent entries -->
    <div class="feed-head">
      <div>
        <div class="label">// recent entries</div>
        <h2 class="display" style="font-size: 20px; margin-top: 8px">
          From the journal
        </h2>
      </div>
      <NuxtLink class="btn btn--ghost btn--sm" to="/journal">
        view all
        <AppIcon name="arrow-right" :size="14" />
      </NuxtLink>
    </div>

    <div class="entries">
      <NuxtLink
        v-for="entry in recentEntries"
        :key="entry.id"
        class="entry"
        to="/journal"
      >
        <div class="entry__thumb ph">
          <div class="topo" style="opacity: 0.4" />
        </div>
        <div class="entry__meta">
          <div class="entry__loc">
            <AppIcon name="pin" :size="11" />
            {{ entry.location }}
          </div>
          <div class="entry__title">{{ entry.title }}</div>
          <p class="entry__excerpt">{{ entry.excerpt }}</p>
          <div class="entry__foot">
            <span>
              <AppIcon
                name="calendar"
                :size="11"
                style="vertical-align: -2px"
              />
              {{ entry.date }}
            </span>
            <span>
              <AppIcon name="image" :size="11" style="vertical-align: -2px" />
              {{ entry.photos }}
            </span>
            <span>
              <AppIcon name="heart" :size="11" style="vertical-align: -2px" />
              {{ entry.likes }}
            </span>
          </div>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatCompact } from "~/utils/formatNumber";
import { useStats } from "~/composables/useStats";
import { useConnections } from "~/composables/useConnections";
import type { Place } from "~/stores/places";
import type { Entry } from "~/stores/entries";
import type { TripStop } from "~/stores/trips";

definePageMeta({ layout: "app", middleware: "auth" });
useHead({ title: "FarFlung — Home" });

// ── Auth ──────────────────────────────────────────────────────────────────────

const { user } = useClerkUser();

function resolveDisplayName(): string {
  const currentUser = user.value;
  if (!currentUser) {
    return "Traveler";
  }
  return (
    currentUser.firstName ||
    currentUser.fullName ||
    currentUser.username ||
    "Traveler"
  );
}

const displayName = computed(resolveDisplayName);

// ── Time-of-day greeting ──────────────────────────────────────────────────────

const HOURS_MORNING_START = 5;
const HOURS_AFTERNOON_START = 12;
const HOURS_EVENING_START = 17;

function resolveTimeOfDay(hour: number): string {
  if (hour >= HOURS_EVENING_START) {
    return "evening";
  }
  if (hour >= HOURS_AFTERNOON_START) {
    return "afternoon";
  }
  if (hour >= HOURS_MORNING_START) {
    return "morning";
  }
  return "night";
}

function buildLocalDateLabel(date: Date): string {
  return date
    .toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    })
    .toLowerCase();
}

function resolveUTCTimeOfDay(date: Date): string {
  return resolveTimeOfDay(date.getUTCHours());
}

// Initialize to empty so server render and first client render match (no
// hydration mismatch). Populated in onMounted (client-side only).
const timeOfDayLabel = ref("");
const localDateLabel = ref("");

// ── Notifications ─────────────────────────────────────────────────────────────

const openNotifications = inject<(() => void) | undefined>(
  "openNotifications",
  undefined,
);

// ── New entry drawer ──────────────────────────────────────────────────────────

const openNewEntry = inject<(() => void) | undefined>(
  "openNewEntry",
  undefined,
);

// ── Command palette ──────────────────────────────────────────────────────────

const openCommandPalette = inject<(() => void) | undefined>(
  "openCommandPalette",
  undefined,
);

// ── Connections / import alert ────────────────────────────────────────────────

const {
  connections,
  importResult,
  actionError: importError,
  importInstagramPhotos,
  fetchConnections,
} = useConnections();

const isImporting = ref(false);

// Tracks whether the user has dismissed the import alert (via close button or
// by disconnecting Instagram). Resets automatically when a fresh import result
// arrives so the result is always acknowledged.
const importAlertDismissed = ref(false);

// Show the alert when Instagram is connected (photos ready to import) OR when
// a prior import result is pending acknowledgement (e.g. re-render after import),
// unless the user has dismissed it.
const showImportAlert = computed(
  () =>
    !importAlertDismissed.value &&
    (connections.value.instagram.connected || importResult.value !== null),
);

// Clear the alert when Instagram is disconnected.
watch(
  () => connections.value.instagram.connected,
  (isConnected) => {
    if (!isConnected) {
      importAlertDismissed.value = true;
    }
  },
);

// Reset dismiss state whenever a fresh import result arrives so the result
// is surfaced to the user rather than silently hidden.
watch(importResult, (result) => {
  if (result !== null) {
    importAlertDismissed.value = false;
  }
});

function dismissImportAlert(): void {
  importAlertDismissed.value = true;
}

async function handleImportAll(): Promise<void> {
  isImporting.value = true;
  try {
    await importInstagramPhotos();
  } finally {
    isImporting.value = false;
  }
}

// ── Stats ─────────────────────────────────────────────────────────────────────

const {
  stats: rawStats,
  displayDistance,
  displayDistanceDelta,
  displayDistanceLabel,
  loadError: statsError,
  fetchStats,
} = useStats();

const stats = computed(() => [
  {
    icon: "pin",
    value: formatCompact(rawStats.value.placesCount),
    label: "Places pinned",
    delta:
      rawStats.value.placesThisWeek > 0
        ? `+${rawStats.value.placesThisWeek} wk`
        : null,
  },
  {
    icon: "globe",
    value: formatCompact(rawStats.value.countriesCount),
    label: "Countries",
    delta: null,
  },
  {
    icon: "plane",
    value: formatCompact(displayDistance.value),
    label: displayDistanceLabel.value,
    delta: (() => {
      const deltaText = formatCompact(displayDistanceDelta.value);
      return deltaText !== "0" ? `+${deltaText} wk` : null;
    })(),
  },
  {
    icon: "flag",
    value: formatCompact(rawStats.value.currentStreak),
    label: "Day streak",
    delta: null,
  },
]);

// ── Places / map pins ─────────────────────────────────────────────────────────

const placesStore = usePlacesStore();

// Maximum number of map pins to render on the dashboard preview.
const MAX_MAP_PINS = 8;

// World bounds for equirectangular projection onto the panel.
const MAP_LON_MIN = -180;
const MAP_LON_MAX = 180;
const MAP_LAT_MIN = -85;
const MAP_LAT_MAX = 85;

// Clamp pin positions so they remain visually inside the panel edges.
const PIN_EDGE_PERCENT = 5;
const PIN_MAX_PERCENT = 95;

function longitudeToPercent(longitude: number): number {
  const rawPercent =
    ((longitude - MAP_LON_MIN) / (MAP_LON_MAX - MAP_LON_MIN)) * 100;
  return Math.min(PIN_MAX_PERCENT, Math.max(PIN_EDGE_PERCENT, rawPercent));
}

function latitudeToPercent(latitude: number): number {
  // Latitude: higher value = further north = closer to top (lower %)
  const rawPercent =
    ((MAP_LAT_MAX - latitude) / (MAP_LAT_MAX - MAP_LAT_MIN)) * 100;
  return Math.min(PIN_MAX_PERCENT, Math.max(PIN_EDGE_PERCENT, rawPercent));
}

function buildMapPin(place: Place, index: number) {
  // latitude/longitude are guaranteed non-null by the filter below
  const left = longitudeToPercent(place.longitude as number);
  const top = latitudeToPercent(place.latitude as number);
  return {
    tip: place.name,
    left: `${left}%`,
    top: `${top}%`,
    // First pin is large; the rest are small
    sm: index > 0,
  };
}

const mapPins = computed(() =>
  placesStore.places
    // Use != null to exclude both null and undefined coordinates
    .filter((place) => place.latitude != null && place.longitude != null)
    .slice(0, MAX_MAP_PINS)
    .map(buildMapPin),
);

// ── Trips / current trip card ─────────────────────────────────────────────────

const tripsStore = useTripsStore();

const ongoingTrip = computed(
  () => tripsStore.tripList.find((trip) => trip.status === "ongoing") ?? null,
);

const ongoingTripDetail = computed(() => {
  if (!ongoingTrip.value) {
    return null;
  }
  if (tripsStore.currentTripDetail?.trip.id === ongoingTrip.value.id) {
    return tripsStore.currentTripDetail;
  }
  return null;
});

const tripStops = computed<TripStop[]>(
  () => ongoingTripDetail.value?.stops ?? [],
);

const doneStopCount = computed(
  () => tripStops.value.filter((stop) => stop.status === "done").length,
);

const tripProgressPercent = computed<number>(() => {
  const totalStops = tripStops.value.length;
  if (totalStops === 0) {
    return 0;
  }
  return Math.round((doneStopCount.value / totalStops) * 100);
});

const tripStopsLabel = computed<string>(() => {
  const totalStops = tripStops.value.length;
  if (totalStops === 0) {
    return "no stops logged";
  }
  return `${doneStopCount.value} of ${totalStops} stops logged`;
});

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const tripDayLabel = computed<string>(() => {
  const trip = ongoingTrip.value;
  if (!trip?.startDate) {
    return "ongoing";
  }
  const start = new Date(trip.startDate).getTime();
  const rawDayNumber = Math.floor((Date.now() - start) / MS_PER_DAY) + 1;

  if (!trip.endDate) {
    return `day ${Math.max(1, rawDayNumber)}`;
  }

  const end = new Date(trip.endDate).getTime();
  const totalDays = Math.ceil((end - start) / MS_PER_DAY);
  if (totalDays <= 0) {
    return "day 1";
  }
  const dayNumber = Math.min(Math.max(1, rawDayNumber), totalDays);
  return `day ${dayNumber} of ${totalDays}`;
});

const tripDaysRemainingLabel = computed<string>(() => {
  const trip = ongoingTrip.value;
  if (!trip?.endDate) {
    return "";
  }
  const end = new Date(trip.endDate).getTime();
  const daysLeft = Math.ceil((end - Date.now()) / MS_PER_DAY);
  if (daysLeft <= 0) {
    return "trip ended";
  }
  return `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;
});

const tripNextStop = computed<TripStop | null>(
  () => tripStops.value.find((stop) => stop.status === "next") ?? null,
);

// ── Journal entries ───────────────────────────────────────────────────────────

const entriesStore = useEntriesStore();

// Number of recent entries to show on the dashboard.
const RECENT_ENTRIES_COUNT = 4;

function buildPlaceNameMap(places: Place[]): Map<string, string> {
  return new Map(places.map((place) => [place.id, place.name]));
}

function formatEntryDate(occurredAt: string | null): string {
  if (!occurredAt) {
    return "";
  }
  return new Date(occurredAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function adaptEntry(entry: Entry, placeNameMap: Map<string, string>) {
  return {
    id: entry.id,
    location: entry.placeId ? (placeNameMap.get(entry.placeId) ?? "") : "",
    title: entry.title,
    excerpt: entry.body ?? "",
    date: formatEntryDate(entry.occurredAt),
    photos: entry.photos.length,
    likes: entry.likeCount,
  };
}

const recentEntries = computed(() => {
  const placeNameMap = buildPlaceNameMap(placesStore.places);
  return entriesStore.entries
    .slice(0, RECENT_ENTRIES_COUNT)
    .map((entry) => adaptEntry(entry, placeNameMap));
});

// ── Mount: fetch all dashboard data ──────────────────────────────────────────

onMounted(() => {
  const now = new Date();
  timeOfDayLabel.value = resolveUTCTimeOfDay(now);
  localDateLabel.value = buildLocalDateLabel(now);

  fetchStats().catch((error: unknown) => {
    console.error("[home] failed to load stats", error);
  });
  fetchConnections().catch((error: unknown) => {
    console.error("[home] failed to load connections", error);
  });

  placesStore.fetchPlaces().catch((error: unknown) => {
    console.error("[home] failed to load places", error);
  });

  entriesStore.fetchEntries().catch((error: unknown) => {
    console.error("[home] failed to load entries", error);
  });

  tripsStore
    .fetchTrips()
    .then(() => {
      const ongoing = tripsStore.tripList.find(
        (trip) => trip.status === "ongoing",
      );
      if (!ongoing) {
        return;
      }
      tripsStore.fetchTripById(ongoing.id).catch((error: unknown) => {
        console.error("[home] failed to load ongoing trip detail", error);
      });
    })
    .catch((error: unknown) => {
      console.error("[home] failed to load trips", error);
    });
});
</script>

<style scoped>
.hello {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 22px;
  flex-wrap: wrap;
}
.hello h1 {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.hello h1 b {
  color: var(--accent-ink);
}
.hello p {
  margin: 6px 0 0;
  font-size: 12.5px;
  color: var(--muted);
}

.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 22px;
}
.stat {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 16px 17px;
  position: relative;
  overflow: hidden;
}
.stat__ico {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: var(--accent-weak);
  color: var(--accent-ink);
  display: grid;
  place-items: center;
  margin-bottom: 12px;
}
.stat__num {
  font-family: var(--font-display);
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1;
}
.stat__lbl {
  font-size: 11px;
  color: var(--muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-top: 6px;
}
.stat__delta {
  position: absolute;
  top: 16px;
  right: 16px;
  font-size: 11px;
  color: var(--success-ink);
}

.cols {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 16px;
  margin-bottom: 22px;
}
.map-card {
  position: relative;
  border-radius: var(--radius);
  overflow: hidden;
  border: 1px solid var(--line);
  min-height: 340px;
  display: flex;
  flex-direction: column;
}
.map-card__bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 16px;
  border-bottom: 1px solid var(--line);
  background: var(--surface);
  z-index: 2;
}
.grow {
  flex: 1;
}
.map-body {
  position: relative;
  flex: 1;
}
.map-body .map-panel {
  position: absolute;
  inset: 0;
  border: none;
  border-radius: 0;
}
.pin-abs {
  position: absolute;
  transform: translate(-50%, -100%);
  cursor: pointer;
}
.pin-abs:hover {
  z-index: 5;
}
.pin-tip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 4px;
  white-space: nowrap;
  background: var(--ink);
  color: var(--bg);
  font-size: 10.5px;
  padding: 3px 7px;
  border-radius: 5px;
  opacity: 0;
  transition: opacity 0.15s;
  pointer-events: none;
}
.pin-abs:hover .pin-tip {
  opacity: 1;
}

.trip-card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 18px;
  display: flex;
  flex-direction: column;
}
.trip-hero {
  height: 120px;
  border-radius: var(--radius-sm);
  position: relative;
  overflow: hidden;
  margin-bottom: 14px;
}
.progress {
  height: 6px;
  border-radius: 99px;
  background: var(--line);
  overflow: hidden;
  margin: 10px 0 6px;
}
.progress span {
  display: block;
  height: 100%;
  background: var(--accent);
  border-radius: 99px;
}
.nextstop {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: auto;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}

.feed-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.entries {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}
.entry {
  display: flex;
  gap: 14px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 12px;
  transition:
    border-color 0.14s,
    transform 0.14s;
  text-decoration: none;
  color: inherit;
}
.entry:hover {
  border-color: var(--accent-line);
  transform: translateY(-2px);
}
.entry__thumb {
  width: 88px;
  height: 88px;
  flex: none;
  border-radius: var(--radius-sm);
}
.entry__meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.entry__loc {
  font-size: 10.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent-ink);
  display: flex;
  align-items: center;
  gap: 5px;
}
.entry__title {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 15px;
  margin: 5px 0 4px;
}
.entry__excerpt {
  font-size: 11.5px;
  color: var(--muted);
  line-height: 1.5;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.entry__foot {
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  color: var(--faint);
}

@media (max-width: 1040px) {
  .stats {
    grid-template-columns: repeat(2, 1fr);
  }
  .cols {
    grid-template-columns: 1fr;
  }
  .entries {
    grid-template-columns: 1fr;
  }
}
</style>
