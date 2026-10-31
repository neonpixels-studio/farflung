import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref, readonly } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import SettingsPage from "../settings.vue";
import type { UserSubscriptionDto } from "~/composables/useBilling";
import { DELETION_GRACE_PERIOD_DAYS } from "~/utils/accountDeletion";
import { useTripsStore } from "~/stores/trips";
import type { Trip } from "~/stores/trips";

// Drives the account section's password-status copy. Defaults to null (Clerk
// user not yet loaded); individual tests set `passwordEnabled` to cover the
// "has a password" / "OAuth-only, no password" cases. Reset in beforeEach so
// one test's value never bleeds into the next. Shaped like the subset of the
// real Clerk user resource the page reads, so populateEmailFromClerk (which
// also watches `user`) doesn't blow up on a partial mock.
type MockClerkUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  passwordEnabled: boolean;
  emailAddresses: { id: string; emailAddress: string }[];
  primaryEmailAddressId: string | null;
  imageUrl: string | null;
};
const clerkUserRef = ref<MockClerkUser | null>(null);
vi.stubGlobal(
  "useClerkUser",
  vi.fn(() => ({ user: clerkUserRef })),
);

function buildClerkUser(overrides: Partial<MockClerkUser> = {}): MockClerkUser {
  return {
    id: "user_clerk_1",
    firstName: "Dan",
    lastName: "Holloran",
    passwordEnabled: true,
    emailAddresses: [],
    primaryEmailAddressId: null,
    imageUrl: null,
    ...overrides,
  };
}

// Scoped to the password row specifically (not just "the first .opt-row
// .btn--outline in the document") so a future row that happens to render an
// outline-style button earlier in the page (e.g. the billing section's
// manage-subscription button on a paid plan) can never be mistaken for it.
// Guards with `.exists()` before `.text()` — a `.opt-row` without a `.lbl b`
// (billing, prefs, privacy, danger all have different markup) would otherwise
// throw from inside `.find()`'s callback and fail every password test with a
// confusing error.
function findPasswordRow(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll(".opt-row").find((row) => {
    const label = row.find(".lbl b");
    return label.exists() && label.text() === "Password";
  });
}

function findPasswordStatus(wrapper: ReturnType<typeof mount>) {
  return findPasswordRow(wrapper)?.find(".lbl p");
}

function findPasswordButton(wrapper: ReturnType<typeof mount>) {
  return findPasswordRow(wrapper)?.find(".btn--outline");
}

const DEFAULT_STATS_DATA = {
  placesCount: 34,
  countriesCount: 9,
  totalDistanceMi: 48218,
  totalDistanceKm: 77600,
  currentStreak: 14,
  placesThisWeek: 6,
  distanceMiThisWeek: 1400,
  distanceKmThisWeek: 2254,
  distanceUnit: "mi" as const,
};

const mockStats = ref({ ...DEFAULT_STATS_DATA });
const mockStatsLoadError = ref<string | null>(null);
const mockFetchStats = vi.fn().mockResolvedValue(undefined);

vi.mock("~/composables/useStats", () => ({
  useStats: vi.fn(() => ({
    stats: mockStats,
    loadError: mockStatsLoadError,
    fetchStats: mockFetchStats,
  })),
}));

const DEFAULT_TRIPS: Trip[] = [
  {
    id: "trip-1",
    userId: "user-1",
    name: "Iceland, the ring road",
    status: "past",
    startDate: "2025-06-20T00:00:00.000Z",
    endDate: "2025-06-29T00:00:00.000Z",
    coverImageId: null,
    distanceKm: 892,
    visibility: "private",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
  {
    id: "trip-2",
    userId: "user-1",
    name: "Portugal, coast to coast",
    status: "upcoming",
    startDate: "2026-07-01T00:00:00.000Z",
    endDate: "2026-07-10T00:00:00.000Z",
    coverImageId: null,
    distanceKm: null,
    visibility: "private",
    createdAt: "2025-01-02T00:00:00.000Z",
    updatedAt: "2025-01-02T00:00:00.000Z",
  },
  {
    id: "trip-3",
    userId: "user-1",
    name: "Norway in winter",
    status: "upcoming",
    startDate: null,
    endDate: null,
    coverImageId: null,
    distanceKm: null,
    visibility: "private",
    createdAt: "2025-01-03T00:00:00.000Z",
    updatedAt: "2025-01-03T00:00:00.000Z",
  },
];

const mockChangePassword = vi.fn().mockResolvedValue(true);
const mockUploadAvatar = vi.fn().mockResolvedValue(null);
const mockRemoveAvatar = vi.fn().mockResolvedValue(true);
const mockDeleteAccount = vi.fn().mockResolvedValue(true);
const mockAccountIsLoading = ref(false);
const mockPasswordError = ref<string | null>(null);
const mockAvatarError = ref<string | null>(null);
const mockDeleteError = ref<string | null>(null);
const mockSignOut = vi.fn().mockResolvedValue(true);
const mockSignOutError = ref<string | null>(null);
const mockUpdateName = vi.fn().mockResolvedValue(true);
const mockNameError = ref<string | null>(null);

vi.mock("~/composables/useAccountActions", () => ({
  useAccountActions: vi.fn(() => ({
    isLoading: readonly(mockAccountIsLoading),
    passwordError: readonly(mockPasswordError),
    avatarError: readonly(mockAvatarError),
    deleteError: readonly(mockDeleteError),
    signOutError: readonly(mockSignOutError),
    nameError: readonly(mockNameError),
    updateName: mockUpdateName,
    changePassword: mockChangePassword,
    uploadAvatar: mockUploadAvatar,
    removeAvatar: mockRemoveAvatar,
    deleteAccount: mockDeleteAccount,
    signOut: mockSignOut,
  })),
}));

const defaultPreferencesData = {
  distanceUnit: "mi" as const,
  defaultMapStyle: "outdoors",
  publicProfile: true,
  preciseLocation: false,
  showOnExplore: true,
  displayName: "Dan H.",
  handle: "danh",
  homeBase: "St. Louis, USA",
  bio: "Chasing cold coffee and warm light.",
};

function makePreferencesMock(
  overrides: {
    savePreferences?: ReturnType<typeof vi.fn>;
    saveError?: string | null;
    loadError?: string | null;
    preferences?: typeof defaultPreferencesData;
  } = {},
) {
  return {
    preferences: ref(overrides.preferences ?? defaultPreferencesData),
    isLoading: readonly(ref(false)),
    loadError: readonly(ref(overrides.loadError ?? null)),
    saveError: readonly(ref(overrides.saveError ?? null)),
    fetchPreferences: vi.fn().mockResolvedValue(undefined),
    savePreferences:
      overrides.savePreferences ?? vi.fn().mockResolvedValue(true),
  };
}

vi.mock("~/composables/usePreferences", () => {
  const { ref: vueRef, readonly: vueReadonly } = require("vue");

  const defaultData = {
    distanceUnit: "mi",
    defaultMapStyle: "outdoors",
    publicProfile: true,
    preciseLocation: false,
    showOnExplore: true,
    displayName: "Dan H.",
    handle: "danh",
    homeBase: "St. Louis, USA",
    bio: "Chasing cold coffee and warm light.",
  };

  return {
    usePreferences: vi.fn(() => ({
      preferences: vueRef(defaultData),
      isLoading: vueReadonly(vueRef(false)),
      loadError: vueReadonly(vueRef(null)),
      saveError: vueReadonly(vueRef(null)),
      fetchPreferences: vi.fn().mockResolvedValue(undefined),
      savePreferences: vi.fn().mockResolvedValue(true),
    })),
    PREFERENCES_DEFAULTS: {
      distanceUnit: "mi",
      defaultMapStyle: "outdoors",
      publicProfile: false,
      preciseLocation: false,
      showOnExplore: true,
      displayName: null,
      handle: null,
      homeBase: null,
      bio: null,
    },
  };
});

vi.mock("~/composables/useApiClient", () => ({
  useApiClient: vi.fn(() => ({
    apiFetch: vi.fn(),
  })),
}));

const WANDERER_SUBSCRIPTION: UserSubscriptionDto = {
  plan: "wanderer",
  status: "active",
  billingCycle: "monthly",
  trialEndsAt: null,
  currentPeriodEnd: "2026-08-01T00:00:00.000Z",
  cancelAtPeriodEnd: false,
};

const NOMAD_SUBSCRIPTION: UserSubscriptionDto = {
  ...WANDERER_SUBSCRIPTION,
  plan: "nomad",
};

const defaultSubscriptionData: UserSubscriptionDto = {
  plan: "drifter",
  status: "active",
  billingCycle: null,
  trialEndsAt: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
};

function makeBillingMock(
  overrides: { subscription?: UserSubscriptionDto } = {},
) {
  return {
    subscription: ref(overrides.subscription ?? defaultSubscriptionData),
    isLoading: readonly(ref(false)),
    loadError: readonly(ref(null)),
    fetchSubscription: vi.fn().mockResolvedValue(undefined),
  };
}

vi.mock("~/composables/useBilling", () => ({
  useBilling: vi.fn(() => makeBillingMock()),
}));

const mockStartInstagramConnect = vi.fn();
const mockStartGoogleConnect = vi.fn();

vi.mock("~/composables/useConnections", () => {
  const { ref: vueRef, readonly: vueReadonly } = require("vue");

  const defaultConnections = {
    instagram: { connected: false },
    google: { connected: false, emailAddress: null, identificationId: null },
  };

  return {
    useConnections: vi.fn(() => ({
      connections: vueReadonly(vueRef(defaultConnections)),
      isLoading: vueReadonly(vueRef(false)),
      loadError: vueReadonly(vueRef(null)),
      actionError: vueReadonly(vueRef(null)),
      importResult: vueReadonly(vueRef(null)),
      fetchConnections: vi.fn().mockResolvedValue(undefined),
      startInstagramConnect: (...args: unknown[]) =>
        mockStartInstagramConnect(...args),
      startGoogleConnect: (...args: unknown[]) =>
        mockStartGoogleConnect(...args),
      disconnectInstagram: vi.fn().mockResolvedValue(true),
      disconnectGoogle: vi.fn().mockResolvedValue(true),
      importInstagramPhotos: vi.fn().mockResolvedValue(true),
    })),
  };
});

const iconStub = { template: "<svg data-icon />" };
const inputStub = {
  name: "InputText",
  template: "<input />",
  props: [
    "modelValue",
    "label",
    "type",
    "placeholder",
    "state",
    "hint",
    "icon",
    "required",
  ],
};
const textareaStub = {
  template: "<textarea />",
  props: ["modelValue", "label", "placeholder", "rows"],
};
const alertStub = {
  name: "AppAlert",
  template: '<div class="alert" />',
  props: ["intent", "title"],
};
const topbarStub = {
  template: '<header class="topbar"><slot /></header>',
  props: ["title", "crumb"],
};
const planManageButtonStub = {
  template: '<button class="plan-manage-btn"><slot /></button>',
};

const globalConfig: {
  global: {
    plugins: unknown[];
    stubs: Record<string, unknown>;
  };
} = {
  global: {
    plugins: [],
    stubs: {
      AppIcon: iconStub,
      AppTopbar: topbarStub,
      InputText: inputStub,
      InputTextarea: textareaStub,
      AppAlert: alertStub,
      PlanManageButton: planManageButtonStub,
      NuxtLink: { template: "<a><slot /></a>", props: ["to"] },
    },
  },
};

describe("Settings page (/settings)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStats.value = { ...DEFAULT_STATS_DATA };
    mockStatsLoadError.value = null;
    mockFetchStats.mockResolvedValue(undefined);

    const pinia = createPinia();
    setActivePinia(pinia);
    globalConfig.global.plugins = [pinia];

    const tripsStore = useTripsStore();
    tripsStore.tripList = [...DEFAULT_TRIPS];
    vi.spyOn(tripsStore, "fetchTrips").mockResolvedValue();

    clerkUserRef.value = null;
    mockUpdateName.mockResolvedValue(true);
    mockNameError.value = null;
  });

  it("renders without crashing and matches snapshot", async () => {
    const wrapper = mount(SettingsPage, globalConfig);
    await flushPromises();
    expect(wrapper.find(".set-layout").exists()).toBe(true);
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("renders the side navigation with all 7 sections", () => {
    const wrapper = mount(SettingsPage, globalConfig);
    expect(wrapper.findAll(".set-nav a")).toHaveLength(7);
  });

  it("renders all 7 settings sections", () => {
    const wrapper = mount(SettingsPage, globalConfig);
    expect(wrapper.findAll(".sect")).toHaveLength(7);
  });

  it("shows an upgrade CTA on the free Drifter plan", () => {
    const wrapper = mount(SettingsPage, globalConfig);
    const billingSection = wrapper.find("#billing");
    expect(billingSection.text()).toContain("Drifter plan");
    expect(billingSection.find(".plan-manage-btn").exists()).toBe(false);
    expect(billingSection.text()).toContain("view plans");
  });

  it("shows a manage-subscription button on a paid plan", async () => {
    const { useBilling } = await import("~/composables/useBilling");
    vi.mocked(useBilling).mockReturnValueOnce(
      makeBillingMock({
        subscription: {
          plan: "wanderer",
          status: "active",
          billingCycle: "monthly",
          trialEndsAt: null,
          currentPeriodEnd: "2026-08-01T00:00:00.000Z",
          cancelAtPeriodEnd: false,
        },
      }),
    );

    const wrapper = mount(SettingsPage, globalConfig);
    const billingSection = wrapper.find("#billing");
    expect(billingSection.text()).toContain("Wanderer plan");
    expect(billingSection.find(".plan-manage-btn").exists()).toBe(true);
    expect(billingSection.text()).toContain("Renews");
  });

  it("shows the trial-ends message when a trial is active", async () => {
    const { useBilling } = await import("~/composables/useBilling");
    // Trial must end in the future for it to count as active, so derive the
    // date from now rather than hardcoding one that silently expires.
    const trialEndsAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    vi.mocked(useBilling).mockReturnValueOnce(
      makeBillingMock({
        subscription: {
          plan: "nomad",
          status: "active",
          billingCycle: "yearly",
          trialEndsAt,
          currentPeriodEnd: trialEndsAt,
          cancelAtPeriodEnd: false,
        },
      }),
    );

    const wrapper = mount(SettingsPage, globalConfig);
    expect(wrapper.find("#billing").text()).toContain("Trial ends");
  });

  it("shows the renewal message (not a stale trial message) once a past trial has converted", async () => {
    const { useBilling } = await import("~/composables/useBilling");
    vi.mocked(useBilling).mockReturnValueOnce(
      makeBillingMock({
        subscription: {
          plan: "nomad",
          status: "active",
          billingCycle: "yearly",
          // Trial ended in the past — the row hasn't necessarily had
          // trialEndsAt cleared (see server/utils/subscriptions.ts), so the
          // UI must not keep showing "Trial ends" once the date has passed.
          trialEndsAt: "2020-01-01T00:00:00.000Z",
          currentPeriodEnd: "2026-08-01T00:00:00.000Z",
          cancelAtPeriodEnd: false,
        },
      }),
    );

    const wrapper = mount(SettingsPage, globalConfig);
    const billingText = wrapper.find("#billing").text();
    expect(billingText).not.toContain("Trial ends");
    expect(billingText).toContain("Renews");
  });

  it("shows a manage-subscription button for a past_due paid plan (not the free-tier upgrade CTA)", async () => {
    const { useBilling } = await import("~/composables/useBilling");
    vi.mocked(useBilling).mockReturnValueOnce(
      makeBillingMock({
        subscription: {
          plan: "wanderer",
          status: "past_due",
          billingCycle: "monthly",
          trialEndsAt: null,
          currentPeriodEnd: "2026-07-15T00:00:00.000Z",
          cancelAtPeriodEnd: false,
        },
      }),
    );

    const wrapper = mount(SettingsPage, globalConfig);
    const billingSection = wrapper.find("#billing");
    expect(billingSection.find(".plan-manage-btn").exists()).toBe(true);
    expect(billingSection.text()).toContain("Wanderer plan");
    expect(billingSection.text()).toContain("Payment issue");
    expect(billingSection.text()).not.toContain("Renews");
  });

  it("shows an access-ends message (not 'Renews') for a canceled subscription", async () => {
    const { useBilling } = await import("~/composables/useBilling");
    vi.mocked(useBilling).mockReturnValueOnce(
      makeBillingMock({
        subscription: {
          plan: "nomad",
          status: "canceled",
          billingCycle: "yearly",
          trialEndsAt: null,
          currentPeriodEnd: "2026-07-20T00:00:00.000Z",
          cancelAtPeriodEnd: false,
        },
      }),
    );

    const wrapper = mount(SettingsPage, globalConfig);
    const billingText = wrapper.find("#billing").text();
    expect(billingText).toContain("Access ends");
    expect(billingText).not.toContain("Renews");
    expect(billingText).not.toContain("Payment issue");
  });

  it("shows an access-ends message (not 'Renews') for a still-active subscription scheduled to cancel", async () => {
    const { useBilling } = await import("~/composables/useBilling");
    vi.mocked(useBilling).mockReturnValueOnce(
      makeBillingMock({
        subscription: {
          plan: "nomad",
          status: "active",
          billingCycle: "yearly",
          trialEndsAt: null,
          currentPeriodEnd: "2026-07-20T00:00:00.000Z",
          cancelAtPeriodEnd: true,
        },
      }),
    );

    const wrapper = mount(SettingsPage, globalConfig);
    const billingSection = wrapper.find("#billing");
    const billingText = billingSection.text();
    expect(billingSection.find(".plan-manage-btn").exists()).toBe(true);
    expect(billingText).toContain("Access ends");
    expect(billingText).not.toContain("Renews");
  });

  it("renders the 6 map style options", () => {
    const wrapper = mount(SettingsPage, globalConfig);
    expect(wrapper.findAll(".map-style")).toHaveLength(6);
  });

  it("toggles map style selection", async () => {
    const { useBilling } = await import("~/composables/useBilling");
    vi.mocked(useBilling).mockReturnValueOnce(
      makeBillingMock({ subscription: WANDERER_SUBSCRIPTION }),
    );
    const wrapper = mount(SettingsPage, globalConfig);
    await flushPromises();
    const styles = wrapper.findAll(".map-style");
    await styles[1].trigger("click");
    expect(styles[1].classes()).toContain("is-active");
    expect(styles[0].classes()).not.toContain("is-active");
  });

  it("toggles unit selection", async () => {
    const wrapper = mount(SettingsPage, globalConfig);
    const buttons = wrapper.findAll(".segmented button");
    await buttons[1].trigger("click");
    expect(buttons[1].classes()).toContain("is-active");
    expect(buttons[0].classes()).not.toContain("is-active");
  });

  it("shows delete confirmation modal when delete button is clicked", async () => {
    const wrapper = mount(SettingsPage, globalConfig);
    expect(wrapper.find(".modal-scrim").classes()).not.toContain("is-open");
    await wrapper.find(".danger .btn").trigger("click");
    expect(wrapper.find(".modal-scrim").classes()).toContain("is-open");
  });

  it("does not promise a change-of-mind window for account deletion", () => {
    const wrapper = mount(SettingsPage, globalConfig);
    const copy = wrapper.find(".danger .opt-row .lbl p").text();
    expect(copy).not.toMatch(/change your mind/i);
    expect(copy).toMatch(/right away/i);
    expect(copy).toMatch(/can't be undone/i);
    expect(copy).toContain(`${DELETION_GRACE_PERIOD_DAYS} days later`);
  });

  it("does not promise a change-of-mind window in the delete confirmation modal", async () => {
    const wrapper = mount(SettingsPage, globalConfig);
    await wrapper.find(".danger .btn").trigger("click");
    const modalCopy = wrapper.find(".modal p").text();
    expect(modalCopy).not.toMatch(/change your mind/i);
    expect(modalCopy).toMatch(/right away/i);
    expect(modalCopy).toContain(`${DELETION_GRACE_PERIOD_DAYS} days later`);
  });

  it("closes delete modal when cancel is clicked", async () => {
    const wrapper = mount(SettingsPage, globalConfig);
    await wrapper.find(".danger .btn").trigger("click");
    await wrapper.find(".modal .btn--ghost").trigger("click");
    expect(wrapper.find(".modal-scrim").classes()).not.toContain("is-open");
  });

  it("shows a generic message (no fabricated zero count) while counts are still loading", async () => {
    // A deferred fetchStats that we control explicitly, rather than relying
    // on how many microtask hops onMounted happens to take — flushPromises()
    // only drains what's already pending, so this stays pending until we
    // resolve it below regardless of the fetch chain's shape.
    let resolveFetchStats: () => void = () => {};
    mockFetchStats.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveFetchStats = resolve;
        }),
    );

    const wrapper = mount(SettingsPage, globalConfig);
    await flushPromises();
    await wrapper.find(".danger .btn").trigger("click");

    const modalText = wrapper.find(".modal").text();
    expect(modalText).not.toContain("0 places");
    expect(modalText).not.toContain("0 trips");
    expect(modalText).toContain(
      "All places, trips and photos are permanently erased",
    );

    resolveFetchStats();
    await flushPromises();
  });

  it("shows the user's real place and trip counts in the delete confirmation, not hardcoded values", async () => {
    const wrapper = mount(SettingsPage, globalConfig);
    await flushPromises();
    await wrapper.find(".danger .btn").trigger("click");

    const modalText = wrapper.find(".modal").text();
    expect(modalText).toContain("34 places");
    expect(modalText).toContain("3 trips");
  });

  it("follows the real data when place/trip counts differ from the default mock, proving the counts are dynamic", async () => {
    mockStats.value = { ...DEFAULT_STATS_DATA, placesCount: 200 };
    const tripsStore = useTripsStore();
    tripsStore.tripList = [
      ...DEFAULT_TRIPS,
      { ...DEFAULT_TRIPS[0], id: "trip-4" },
      { ...DEFAULT_TRIPS[1], id: "trip-5" },
    ];

    const wrapper = mount(SettingsPage, globalConfig);
    await flushPromises();
    await wrapper.find(".danger .btn").trigger("click");

    const modalText = wrapper.find(".modal").text();
    expect(modalText).toContain("200 places");
    expect(modalText).toContain("5 trips");
  });

  it("falls back to generic wording (no fabricated zero count) when stats fail to load", async () => {
    // Mirrors the real useStats().fetchStats contract: it never rejects — on
    // failure it resolves after resetting stats to zero and setting
    // loadError, which is exactly the "0 places" trap this guard exists to
    // avoid falling into.
    mockFetchStats.mockImplementationOnce(async () => {
      mockStats.value = { ...DEFAULT_STATS_DATA, placesCount: 0 };
      mockStatsLoadError.value = "Failed to load stats";
    });

    const wrapper = mount(SettingsPage, globalConfig);
    await flushPromises();
    await wrapper.find(".danger .btn").trigger("click");

    const modalText = wrapper.find(".modal").text();
    expect(modalText).not.toContain("0 places");
    expect(modalText).not.toContain("0 trips");
    expect(modalText).toContain(
      "All places, trips and photos are permanently erased",
    );
  });

  it("falls back to generic wording (no fabricated zero count) when the trips list fails to load", async () => {
    const tripsStore = useTripsStore();
    vi.spyOn(tripsStore, "fetchTrips").mockRejectedValue(
      new Error("Failed to load trips"),
    );

    const wrapper = mount(SettingsPage, globalConfig);
    await flushPromises();
    await wrapper.find(".danger .btn").trigger("click");

    const modalText = wrapper.find(".modal").text();
    expect(modalText).not.toContain("0 places");
    expect(modalText).not.toContain("0 trips");
    expect(modalText).toContain(
      "All places, trips and photos are permanently erased",
    );
  });

  it("uses singular wording for exactly one place and one trip", async () => {
    mockStats.value = { ...DEFAULT_STATS_DATA, placesCount: 1 };
    const tripsStore = useTripsStore();
    tripsStore.tripList = [DEFAULT_TRIPS[0]];

    const wrapper = mount(SettingsPage, globalConfig);
    await flushPromises();
    await wrapper.find(".danger .btn").trigger("click");

    const modalText = wrapper.find(".modal").text();
    expect(modalText).toContain("1 place");
    expect(modalText).not.toContain("1 places");
    expect(modalText).toContain("1 trip");
    expect(modalText).not.toContain("1 trips");
  });

  it("disables save and hides discard until something changes", async () => {
    const wrapper = mount(SettingsPage, globalConfig);
    await flushPromises();
    const saveButton = wrapper.find(".btn--primary");
    expect(saveButton.attributes("disabled")).toBeDefined();
    expect(wrapper.findAll("button").map((b) => b.text())).not.toContain(
      "discard",
    );

    await wrapper.findAll(".segmented button")[1].trigger("click");
    await flushPromises();

    expect(saveButton.attributes("disabled")).toBeUndefined();
    expect(wrapper.findAll("button").map((b) => b.text())).toContain("discard");
  });

  it("goes back to no changes when an edit is undone by hand", async () => {
    const wrapper = mount(SettingsPage, globalConfig);
    await flushPromises();
    const unitButtons = wrapper.findAll(".segmented button");
    await unitButtons[1].trigger("click");
    await unitButtons[0].trigger("click");
    await flushPromises();
    expect(wrapper.find(".btn--primary").attributes("disabled")).toBeDefined();
  });

  it("discard restores saved values, including names", async () => {
    clerkUserRef.value = buildClerkUser();
    const wrapper = mount(SettingsPage, globalConfig);
    await flushPromises();
    const profile = (
      wrapper.vm as unknown as {
        profile: { bio: string; firstName: string };
      }
    ).profile;
    const savedFirstName = profile.firstName;
    const savedBio = profile.bio;
    profile.bio = "Edited bio";
    profile.firstName = "Edited";
    await flushPromises();

    const discardButton = wrapper
      .findAll("button")
      .find((button) => button.text() === "discard");
    await discardButton?.trigger("click");
    await flushPromises();

    expect(profile.bio).toBe(savedBio);
    expect(profile.firstName).toBe(savedFirstName);
    expect(wrapper.find(".btn--primary").attributes("disabled")).toBeDefined();
  });

  it("shows saved toast after a successful save", async () => {
    const wrapper = mount(SettingsPage, globalConfig);
    expect(wrapper.find(".saved-bar").classes()).not.toContain("show");
    await wrapper.findAll(".segmented button")[1].trigger("click");
    await wrapper.vm.$nextTick();
    await wrapper.find(".btn--primary").trigger("click");
    await flushPromises();
    expect(wrapper.find(".saved-bar").classes()).toContain("show");
  });

  it("sends only the fields that changed, not the whole form", async () => {
    const { usePreferences } = await import("~/composables/usePreferences");
    const savePreferencesMock = vi.fn().mockResolvedValue(true);
    vi.mocked(usePreferences).mockReturnValueOnce(
      makePreferencesMock({ savePreferences: savePreferencesMock }),
    );

    const wrapper = mount(SettingsPage, globalConfig);
    await wrapper.findAll(".segmented button")[1].trigger("click");
    await wrapper.find(".btn--primary").trigger("click");
    await flushPromises();

    expect(savePreferencesMock).toHaveBeenCalledTimes(1);
    expect(savePreferencesMock.mock.calls[0][0]).toEqual({
      distanceUnit: "km",
    });
  });

  it("does not call savePreferences or updateName when nothing changed", async () => {
    const { usePreferences } = await import("~/composables/usePreferences");
    const savePreferencesMock = vi.fn().mockResolvedValue(true);
    vi.mocked(usePreferences).mockReturnValueOnce(
      makePreferencesMock({ savePreferences: savePreferencesMock }),
    );
    clerkUserRef.value = buildClerkUser();

    const wrapper = mount(SettingsPage, globalConfig);
    await flushPromises();
    await wrapper.find(".btn--primary").trigger("click");
    await flushPromises();

    expect(savePreferencesMock).not.toHaveBeenCalled();
    expect(mockUpdateName).not.toHaveBeenCalled();
  });

  it("lets a Drifter save an unrelated field without sending paid-only fields (no 402)", async () => {
    const { usePreferences } = await import("~/composables/usePreferences");
    const savePreferencesMock = vi.fn().mockResolvedValue(true);
    vi.mocked(usePreferences).mockReturnValueOnce(
      makePreferencesMock({
        savePreferences: savePreferencesMock,
        preferences: { ...defaultPreferencesData, publicProfile: false },
      }),
    );

    const wrapper = mount(SettingsPage, globalConfig);
    await flushPromises();
    (wrapper.vm as unknown as { profile: { bio: string } }).profile.bio =
      "New bio";
    await flushPromises();
    await wrapper.find(".btn--primary").trigger("click");
    await flushPromises();

    expect(savePreferencesMock).toHaveBeenCalledTimes(1);
    const payload = savePreferencesMock.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(payload).toEqual({ bio: "New bio" });
    expect(payload).not.toHaveProperty("publicProfile");
    expect(payload).not.toHaveProperty("defaultMapStyle");
  });

  describe("name", () => {
    function setForm(
      wrapper: ReturnType<typeof mount>,
      fields: Record<string, string>,
    ) {
      const profile = (
        wrapper.vm as unknown as { profile: Record<string, string> }
      ).profile;
      Object.assign(profile, fields);
    }

    it("fills first and last name from Clerk, as two separate fields", async () => {
      clerkUserRef.value = buildClerkUser();
      const wrapper = mount(SettingsPage, globalConfig);
      await flushPromises();

      const labels = wrapper
        .findAllComponents({ name: "InputText" })
        .map((input) => input.props("label"));
      expect(labels).toContain("First name");
      expect(labels).toContain("Last name");
      expect(labels).not.toContain("Display name");

      const profile = (
        wrapper.vm as unknown as { profile: Record<string, string> }
      ).profile;
      expect(profile.firstName).toBe("Dan");
      expect(profile.lastName).toBe("Holloran");
    });

    it("saves a changed name through updateName, not through preferences", async () => {
      const { usePreferences } = await import("~/composables/usePreferences");
      const savePreferencesMock = vi.fn().mockResolvedValue(true);
      vi.mocked(usePreferences).mockReturnValueOnce(
        makePreferencesMock({ savePreferences: savePreferencesMock }),
      );
      clerkUserRef.value = buildClerkUser();
      const wrapper = mount(SettingsPage, globalConfig);
      await flushPromises();

      setForm(wrapper, { firstName: "Daniel", lastName: "Holloran" });
      await flushPromises();
      await wrapper.find(".btn--primary").trigger("click");
      await flushPromises();

      expect(mockUpdateName).toHaveBeenCalledWith("Daniel", "Holloran");
      expect(savePreferencesMock).not.toHaveBeenCalled();
    });

    it("allows a user with no last name", async () => {
      clerkUserRef.value = buildClerkUser({ lastName: "Holloran" });
      const wrapper = mount(SettingsPage, globalConfig);
      await flushPromises();

      setForm(wrapper, { lastName: "" });
      await flushPromises();
      await wrapper.find(".btn--primary").trigger("click");
      await flushPromises();

      expect(mockUpdateName).toHaveBeenCalledWith("Dan", "");
    });

    it("requires a first name and does not call updateName without one", async () => {
      clerkUserRef.value = buildClerkUser();
      const wrapper = mount(SettingsPage, globalConfig);
      await flushPromises();

      setForm(wrapper, { firstName: "   " });
      await flushPromises();
      await wrapper.find(".btn--primary").trigger("click");
      await flushPromises();

      expect(mockUpdateName).not.toHaveBeenCalled();
      expect(wrapper.find(".saved-bar").classes()).toContain("show");
      expect(wrapper.find(".alert").exists()).toBe(true);
    });

    it("shows the error toast when the name save fails", async () => {
      mockUpdateName.mockResolvedValue(false);
      mockNameError.value = "Could not save";
      clerkUserRef.value = buildClerkUser();
      const wrapper = mount(SettingsPage, globalConfig);
      await flushPromises();

      setForm(wrapper, { firstName: "Daniel" });
      await flushPromises();
      await wrapper.find(".btn--primary").trigger("click");
      await flushPromises();

      expect(wrapper.find(".saved-bar").attributes("class")).toContain("show");
      expect(wrapper.findComponent({ name: "AppAlert" }).props("title")).toBe(
        "Could not save",
      );
    });
  });

  describe("public handle", () => {
    it("shows the saved handle's real URL, not a hard-coded one", async () => {
      const { usePreferences } = await import("~/composables/usePreferences");
      vi.mocked(usePreferences).mockReturnValueOnce(
        makePreferencesMock({
          preferences: { ...defaultPreferencesData, handle: "grimicorn" },
        }),
      );
      const wrapper = mount(SettingsPage, globalConfig);
      await flushPromises();

      const description = wrapper.find('[data-testid="public-profile-url"]');
      expect(description.text()).toContain("/@grimicorn");
      expect(description.text()).not.toContain("danh");
    });

    it("falls back to the id URL when no handle is set", async () => {
      const { usePreferences } = await import("~/composables/usePreferences");
      vi.mocked(usePreferences).mockReturnValueOnce(
        makePreferencesMock({
          preferences: { ...defaultPreferencesData, handle: null as never },
        }),
      );
      clerkUserRef.value = buildClerkUser();
      const wrapper = mount(SettingsPage, globalConfig);
      await flushPromises();

      expect(
        wrapper.find('[data-testid="public-profile-url"]').text(),
      ).toContain("/u/user_clerk_1");
    });

    it("no longer renders an always-green success state on the handle field", async () => {
      const wrapper = mount(SettingsPage, globalConfig);
      await flushPromises();

      const handleInput = wrapper
        .findAllComponents({ name: "InputText" })
        .find((input) => input.props("label") === "Public handle");
      expect(handleInput?.props("state")).toBe("default");
    });

    it("blocks the save and reports why when the handle breaks the format rules", async () => {
      const { usePreferences } = await import("~/composables/usePreferences");
      const savePreferencesMock = vi.fn().mockResolvedValue(true);
      vi.mocked(usePreferences).mockReturnValueOnce(
        makePreferencesMock({ savePreferences: savePreferencesMock }),
      );
      const wrapper = mount(SettingsPage, globalConfig);
      await flushPromises();

      (
        wrapper.vm as unknown as { profile: { handle: string } }
      ).profile.handle = "no spaces!";
      await flushPromises();

      const handleInput = wrapper
        .findAllComponents({ name: "InputText" })
        .find((input) => input.props("label") === "Public handle");
      expect(handleInput?.props("state")).toBe("error");
      expect(handleInput?.props("hint")).toContain("letters, numbers");

      await wrapper.find(".btn--primary").trigger("click");
      await flushPromises();

      expect(savePreferencesMock).not.toHaveBeenCalled();
    });
  });

  describe("plan-gated controls for a Drifter", () => {
    it("locks the paid map style tiles and explains why, leaving Outdoors usable", async () => {
      const wrapper = mount(SettingsPage, globalConfig);
      await flushPromises();

      const tiles = wrapper.findAll(".map-style");
      const unlocked = tiles.filter((tile) => !tile.classes("is-locked"));
      expect(unlocked).toHaveLength(1);
      expect(unlocked[0].text()).toContain("Outdoors");
      expect(
        tiles[1].find("input[type=radio]").attributes("disabled"),
      ).toBeDefined();
      expect(wrapper.find('[data-testid="map-style-upgrade"]').exists()).toBe(
        true,
      );
    });

    it("does not let a locked map style be selected", async () => {
      const wrapper = mount(SettingsPage, globalConfig);
      await flushPromises();

      const tiles = wrapper.findAll(".map-style");
      await tiles[2].trigger("click");

      expect(tiles[2].classes()).not.toContain("is-active");
      expect(tiles[0].classes()).toContain("is-active");
    });

    it("disables the public profile toggle with an upgrade hint", async () => {
      const { usePreferences } = await import("~/composables/usePreferences");
      vi.mocked(usePreferences).mockReturnValueOnce(
        makePreferencesMock({
          preferences: { ...defaultPreferencesData, publicProfile: false },
        }),
      );
      const wrapper = mount(SettingsPage, globalConfig);
      await flushPromises();

      const toggle = wrapper.find(".switch input");
      expect(toggle.attributes("disabled")).toBeDefined();
      expect(
        wrapper.find('[data-testid="public-profile-upgrade"]').exists(),
      ).toBe(true);
    });

    it("leaves the public profile toggle usable on the Nomad plan", async () => {
      const { useBilling } = await import("~/composables/useBilling");
      vi.mocked(useBilling).mockReturnValueOnce(
        makeBillingMock({ subscription: NOMAD_SUBSCRIPTION }),
      );
      const { usePreferences } = await import("~/composables/usePreferences");
      vi.mocked(usePreferences).mockReturnValueOnce(
        makePreferencesMock({
          preferences: { ...defaultPreferencesData, publicProfile: false },
        }),
      );
      const wrapper = mount(SettingsPage, globalConfig);
      await flushPromises();

      expect(
        wrapper.find(".switch input").attributes("disabled"),
      ).toBeUndefined();
      expect(
        wrapper.find('[data-testid="public-profile-upgrade"]').exists(),
      ).toBe(false);
    });

    it("keeps a lapsed subscriber able to turn an already-on public profile off", async () => {
      const wrapper = mount(SettingsPage, globalConfig);
      await flushPromises();

      // defaultPreferencesData has publicProfile: true on a Drifter.
      expect(
        wrapper.find(".switch input").attributes("disabled"),
      ).toBeUndefined();
    });
  });

  describe("connections", () => {
    it("offers a Drifter an upgrade prompt instead of an Instagram connect button", async () => {
      const wrapper = mount(SettingsPage, globalConfig);
      await flushPromises();

      const connections = wrapper.find("#connections");
      expect(
        connections.find('[data-testid="instagram-upgrade"]').exists(),
      ).toBe(true);
      const connectButtons = connections
        .findAll("button")
        .filter((button) => button.text().includes("connect"));
      // Only the Google connect button remains.
      expect(connectButtons).toHaveLength(1);
      expect(connectButtons[0].attributes("data-testid")).toBe(
        "google-connect",
      );
    });

    it("shows the Instagram connect button on a paid plan and starts the flow", async () => {
      const { useBilling } = await import("~/composables/useBilling");
      vi.mocked(useBilling).mockReturnValueOnce(
        makeBillingMock({ subscription: WANDERER_SUBSCRIPTION }),
      );
      const wrapper = mount(SettingsPage, globalConfig);
      await flushPromises();

      expect(wrapper.find('[data-testid="instagram-upgrade"]').exists()).toBe(
        false,
      );
      const connect = wrapper
        .findAll("#connections .btn--primary")
        .find(
          (button) => button.attributes("data-testid") !== "google-connect",
        );
      await connect?.trigger("click");

      expect(mockStartInstagramConnect).toHaveBeenCalledTimes(1);
    });

    it("starts the Google connection from the connect button", async () => {
      const wrapper = mount(SettingsPage, globalConfig);
      await flushPromises();

      await wrapper.find('[data-testid="google-connect"]').trigger("click");

      expect(mockStartGoogleConnect).toHaveBeenCalledTimes(1);
    });
  });

  it("does not call savePreferences when loadError is set", async () => {
    const { usePreferences } = await import("~/composables/usePreferences");
    const savePreferencesMock = vi.fn().mockResolvedValue(true);
    vi.mocked(usePreferences).mockReturnValueOnce(
      makePreferencesMock({
        savePreferences: savePreferencesMock,
        loadError: "Failed to load preferences",
      }),
    );

    const wrapper = mount(SettingsPage, globalConfig);
    await wrapper.find(".btn--primary").trigger("click");
    await wrapper.vm.$nextTick();

    expect(savePreferencesMock).not.toHaveBeenCalled();
  });

  it("shows no password-status line while the Clerk user hasn't loaded (no fabricated date)", () => {
    const wrapper = mount(SettingsPage, globalConfig);

    expect(findPasswordStatus(wrapper)?.exists()).toBe(false);
  });

  it("shows an honest no-password message for an OAuth-only account, not a fabricated date", async () => {
    clerkUserRef.value = buildClerkUser({ passwordEnabled: false });
    const wrapper = mount(SettingsPage, globalConfig);
    await wrapper.vm.$nextTick();

    expect(findPasswordStatus(wrapper)?.text()).toBe(
      "No password set — you sign in with a connected account.",
    );
  });

  it("does not show a fabricated last-changed date when the account has a password", async () => {
    clerkUserRef.value = buildClerkUser({ passwordEnabled: true });
    const wrapper = mount(SettingsPage, globalConfig);
    await wrapper.vm.$nextTick();

    const statusText = findPasswordStatus(wrapper)?.text();
    expect(statusText).not.toMatch(/ago/i);
    expect(statusText).toBe("Change your password any time below.");
  });

  it("keeps the password status reactive when the Clerk user resolves after mount", async () => {
    // clerkUserRef starts null via beforeEach — the Clerk user hasn't loaded yet.
    const wrapper = mount(SettingsPage, globalConfig);

    expect(findPasswordStatus(wrapper)?.exists()).toBe(false);
    expect(findPasswordButton(wrapper)?.text()).toBe("change password");

    clerkUserRef.value = buildClerkUser({ passwordEnabled: true });
    await wrapper.vm.$nextTick();

    expect(findPasswordStatus(wrapper)?.text()).toBe(
      "Change your password any time below.",
    );
    expect(findPasswordButton(wrapper)?.text()).toBe("change password");
  });

  it("offers to set (not change) a password for an OAuth-only account", async () => {
    clerkUserRef.value = buildClerkUser({ passwordEnabled: false });
    const wrapper = mount(SettingsPage, globalConfig);
    await wrapper.vm.$nextTick();

    expect(findPasswordButton(wrapper)?.text()).toBe("set password");
  });

  it("switches from 'set password' back to 'change password' once an OAuth-only user adds one", async () => {
    clerkUserRef.value = buildClerkUser({ passwordEnabled: false });
    const wrapper = mount(SettingsPage, globalConfig);
    await wrapper.vm.$nextTick();

    expect(findPasswordButton(wrapper)?.text()).toBe("set password");
    expect(findPasswordStatus(wrapper)?.text()).toBe(
      "No password set — you sign in with a connected account.",
    );

    clerkUserRef.value = buildClerkUser({ passwordEnabled: true });
    await wrapper.vm.$nextTick();

    expect(findPasswordButton(wrapper)?.text()).toBe("change password");
    expect(findPasswordStatus(wrapper)?.text()).toBe(
      "Change your password any time below.",
    );
  });

  it("shows password error when passwords do not match", async () => {
    const wrapper = mount(SettingsPage, globalConfig);

    // Open password fields
    const changePasswordBtn = wrapper
      .findAll(".opt-row .btn--outline")
      .find((btn) => btn.text().includes("change password"));
    await changePasswordBtn?.trigger("click");
    await wrapper.vm.$nextTick();

    // In Vue 3 with <script setup>, the component proxy auto-unwraps refs on
    // assignment — setting vm.foo = "bar" writes through to the underlying ref.
    const vm = wrapper.vm as unknown as Record<string, string>;
    vm.passwordNew = "newpassword1";
    vm.passwordConfirm = "different123";

    const updatePasswordBtn = wrapper
      .findAll(".btn--primary")
      .find((btn) => btn.text().includes("update password"));
    await updatePasswordBtn?.trigger("click");
    await wrapper.vm.$nextTick();

    expect(mockChangePassword).not.toHaveBeenCalled();
    expect(wrapper.find(".account-field-error").exists()).toBe(true);
  });

  it("calls changePassword with correct value and hides fields on success", async () => {
    const wrapper = mount(SettingsPage, globalConfig);

    const changePasswordBtn = wrapper
      .findAll(".opt-row .btn--outline")
      .find((btn) => btn.text().includes("change password"));
    await changePasswordBtn?.trigger("click");
    await wrapper.vm.$nextTick();

    const vm = wrapper.vm as unknown as Record<string, string>;
    vm.passwordNew = "validpassword";
    vm.passwordConfirm = "validpassword";

    const updatePasswordBtn = wrapper
      .findAll(".btn--primary")
      .find((btn) => btn.text().includes("update password"));
    await updatePasswordBtn?.trigger("click");
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expect(mockChangePassword).toHaveBeenCalledWith("validpassword");
  });

  it("signs out when the sign out button is clicked", async () => {
    mockSignOut.mockClear();
    const wrapper = mount(SettingsPage, globalConfig);

    await wrapper.find('[data-testid="sign-out"]').trigger("click");

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("shows the error when signing out fails", async () => {
    mockSignOutError.value = "Network down";
    const wrapper = mount(SettingsPage, globalConfig);

    expect(wrapper.find("#account").text()).toContain("Network down");
    mockSignOutError.value = null;
  });

  it("calls deleteAccount when delete forever is clicked with DELETE typed", async () => {
    const wrapper = mount(SettingsPage, globalConfig);

    // Open delete modal
    await wrapper.find(".danger .btn").trigger("click");
    await wrapper.vm.$nextTick();

    // Set deleteConfirm via the component proxy (ref is auto-unwrapped on set)
    const vm = wrapper.vm as unknown as Record<string, string>;
    vm.deleteConfirm = "DELETE";
    await wrapper.vm.$nextTick();

    const deleteBtn = wrapper
      .findAll(".modal .btn")
      .find((btn) => btn.text().includes("delete forever"));
    await deleteBtn?.trigger("click");
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
  });

  it("shows error toast (not success toast) when save fails", async () => {
    const { usePreferences } = await import("~/composables/usePreferences");
    const savePreferencesMock = vi.fn().mockResolvedValue(false);
    vi.mocked(usePreferences).mockReturnValueOnce(
      makePreferencesMock({
        savePreferences: savePreferencesMock,
        saveError: null,
      }),
    );

    const wrapper = mount(SettingsPage, globalConfig);
    await wrapper.findAll(".segmented button")[1].trigger("click");
    await wrapper.find(".btn--primary").trigger("click");
    await flushPromises();
    // The error bar has show class; the success bar is hidden via v-else
    const allSavedBars = wrapper.findAll(".saved-bar");
    expect(allSavedBars[0].classes()).toContain("show");
    // Only one bar is rendered at a time (v-if / v-else)
    expect(allSavedBars).toHaveLength(1);
  });
});
