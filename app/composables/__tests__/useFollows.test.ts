import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as vue from "vue";

const mockApiFetch = vi.fn();

vi.stubGlobal("useApiClient", () => ({ apiFetch: mockApiFetch }));

// useState in vitest.setup.ts: useState<T>(key, init?) => ref(init?.())
// The global setup already provides this; it's available because vitest.setup.ts
// runs before this file. We re-stub it here so each test gets a fresh ref.
vi.stubGlobal("useState", <T>(_key: string, init?: () => T) =>
  vue.ref(init?.()),
);

const { useFollows } = await import("../useFollows");

describe("useFollows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Error-path tests exercise the catch block, which logs via console.error.
    // Silence it so the expected log doesn't pollute test output.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes followingIds as an empty Set", () => {
    const { followingIds } = useFollows();
    expect(followingIds.value.size).toBe(0);
  });

  it("fetchFollowing populates followingIds from the API response", async () => {
    mockApiFetch.mockResolvedValue({ followingIds: ["user-2", "user-3"] });
    const { fetchFollowing, followingIds } = useFollows();

    await fetchFollowing();

    expect(followingIds.value).toEqual(new Set(["user-2", "user-3"]));
  });

  it("fetchFollowing resets error at the start of a successful fetch", async () => {
    // First call fails
    mockApiFetch.mockRejectedValueOnce(new Error("Network error"));
    const { fetchFollowing, error } = useFollows();
    await fetchFollowing();
    expect(error.value).toBeTruthy();

    // Second call succeeds — error should be cleared
    mockApiFetch.mockResolvedValue({ followingIds: [] });
    await fetchFollowing();
    expect(error.value).toBeNull();
  });

  it("fetchFollowing does not throw on API error (logs it instead)", async () => {
    mockApiFetch.mockRejectedValue(new Error("Network error"));
    const { fetchFollowing, error } = useFollows();

    await expect(fetchFollowing()).resolves.toBeUndefined();
    expect(error.value).toBeTruthy();
    expect(console.error).toHaveBeenCalled();
  });

  it("isFollowing returns true for an ID that is in followingIds", async () => {
    mockApiFetch.mockResolvedValue({ followingIds: ["user-2"] });
    const { fetchFollowing, isFollowing } = useFollows();
    await fetchFollowing();

    expect(isFollowing("user-2")).toBe(true);
  });

  it("isFollowing returns false for an ID not in followingIds", () => {
    const { isFollowing } = useFollows();
    expect(isFollowing("user-nobody")).toBe(false);
  });

  it("isPending returns false before a toggle is started", () => {
    const { isPending } = useFollows();
    expect(isPending("user-2")).toBe(false);
  });

  it("toggleFollow calls POST /api/follows and adds the userId to followingIds", async () => {
    mockApiFetch.mockResolvedValue({ ok: true });
    const { toggleFollow, followingIds } = useFollows();

    await toggleFollow("user-2");

    expect(mockApiFetch).toHaveBeenCalledWith("/api/follows", {
      method: "POST",
      body: { followeeId: "user-2" },
    });
    expect(followingIds.value.has("user-2")).toBe(true);
  });

  it("toggleFollow calls DELETE /api/follows/:id and removes the userId from followingIds", async () => {
    mockApiFetch
      .mockResolvedValueOnce({ followingIds: ["user-2"] })
      .mockResolvedValue({ ok: true });

    const { fetchFollowing, toggleFollow, followingIds } = useFollows();
    await fetchFollowing();

    await toggleFollow("user-2");

    expect(mockApiFetch).toHaveBeenCalledWith("/api/follows/user-2", {
      method: "DELETE",
    });
    expect(followingIds.value.has("user-2")).toBe(false);
  });

  it("toggleFollow does not throw on API error and sets error state", async () => {
    mockApiFetch.mockRejectedValue(new Error("Server error"));
    const { toggleFollow, error } = useFollows();

    await expect(toggleFollow("user-2")).resolves.toBeUndefined();
    expect(error.value).toBeTruthy();
  });

  it("toggleFollow is a no-op for the same userId when already in progress (per-user guard)", async () => {
    let resolveFirst!: () => void;
    const firstCallPromise = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    mockApiFetch.mockReturnValueOnce(
      firstCallPromise.then(() => ({ ok: true })),
    );

    const { toggleFollow } = useFollows();

    // Start the first toggle without awaiting
    const firstToggle = toggleFollow("user-2");

    // Attempt a second toggle for the *same* userId while the first is in flight
    const secondToggle = toggleFollow("user-2");

    resolveFirst();
    await firstToggle;
    await secondToggle;

    // Only the first call should have reached the API
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
  });

  it("toggleFollow allows concurrent toggles for different user IDs", async () => {
    let resolveElsa!: () => void;
    const elsaPromise = new Promise<void>((resolve) => {
      resolveElsa = resolve;
    });
    mockApiFetch
      .mockReturnValueOnce(elsaPromise.then(() => ({ ok: true })))
      .mockResolvedValue({ ok: true });

    const { toggleFollow } = useFollows();

    // Start toggle for elsa without awaiting
    const elsaToggle = toggleFollow("user-elsa");

    // Immediately toggle a *different* user — should not be blocked
    const marcoToggle = toggleFollow("user-marco");

    resolveElsa();
    await elsaToggle;
    await marcoToggle;

    // Both users should have had their toggle request reach the API
    expect(mockApiFetch).toHaveBeenCalledTimes(2);
  });

  it("fetchFollowing skips the state overwrite when a toggle is in flight", async () => {
    let resolveToggle!: () => void;
    const togglePromise = new Promise<void>((resolve) => {
      resolveToggle = resolve;
    });
    // First apiFetch call is the toggle POST (in-flight); second is the fetch GET.
    mockApiFetch
      .mockReturnValueOnce(togglePromise.then(() => ({ ok: true })))
      .mockResolvedValue({ followingIds: [] });

    const { toggleFollow, fetchFollowing, followingIds } = useFollows();

    // Start the toggle without awaiting so it stays in-flight
    const toggleInFlight = toggleFollow("user-2");

    // fetchFollowing fires while the toggle is pending
    await fetchFollowing();

    // The fetch returned an empty list, but the overwrite should have been
    // skipped because pendingUserIds is non-empty — followingIds should still
    // reflect the optimistic add from the ongoing toggle.
    // (The toggle already ran the optimistic add synchronously before the await.)
    resolveToggle();
    await toggleInFlight;

    // After the toggle resolves the user should be in the set
    expect(followingIds.value.has("user-2")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Cross-instance shared-state tests
//
// These tests use a key-caching useState stub to verify that pendingUserIds
// is actually shared across two useFollows() instances (matching the contract
// documented in the source comment). The fresh-ref stub used above cannot
// demonstrate this because it gives every call its own independent ref.
// ---------------------------------------------------------------------------

describe("useFollows — cross-instance shared pendingUserIds", () => {
  let stateStore: Map<string, ReturnType<typeof vue.ref>>;

  beforeEach(() => {
    vi.clearAllMocks();
    stateStore = new Map();
    vi.stubGlobal("useState", <T>(key: string, init?: () => T): vue.Ref<T> => {
      if (!stateStore.has(key)) {
        stateStore.set(key, vue.ref(init?.()));
      }
      return stateStore.get(key) as vue.Ref<T>;
    });
  });

  afterEach(() => {
    // Restore the per-call stub used by the main describe block
    vi.stubGlobal("useState", <T>(_key: string, init?: () => T) =>
      vue.ref(init?.()),
    );
  });

  it("a toggle in-flight on instance A is seen as pending on instance B", async () => {
    let resolveFirst!: () => void;
    const firstCallPromise = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    mockApiFetch.mockReturnValueOnce(
      firstCallPromise.then(() => ({ ok: true })),
    );

    const instanceA = useFollows();
    const instanceB = useFollows();

    // Start a toggle on instance A without awaiting
    const inFlight = instanceA.toggleFollow("user-2");

    // Instance B should see the same userId as pending
    expect(instanceB.isPending("user-2")).toBe(true);

    resolveFirst();
    await inFlight;

    // Once the toggle settles the pending flag should be cleared on both
    expect(instanceA.isPending("user-2")).toBe(false);
    expect(instanceB.isPending("user-2")).toBe(false);
  });
});

describe("useFollows viewer reset", () => {
  let userRef: vue.Ref<{ id: string } | null>;
  const stateStore = new Map<string, vue.Ref<unknown>>();
  let scope: vue.EffectScope;

  function useFollowsInScope(): ReturnType<typeof useFollows> {
    return scope.run(() => useFollows())!;
  }

  afterEach(() => {
    scope.stop();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    scope = vue.effectScope();
    userRef = vue.ref<{ id: string } | null>({ id: "viewer-1" });
    stateStore.clear();
    vi.stubGlobal("useClerkUser", () => ({ user: userRef }));
    vi.stubGlobal("useState", <T>(key: string, init?: () => T) => {
      if (!stateStore.has(key)) {
        stateStore.set(key, vue.ref(init?.()));
      }
      return stateStore.get(key);
    });
  });

  it("clears followingIds and pendingUserIds on sign-out for a mounted consumer", async () => {
    const { followingIds, pendingUserIds } = useFollowsInScope();
    followingIds.value = new Set(["user-2"]);
    pendingUserIds.value = new Set(["user-3"]);

    userRef.value = null;
    await vue.nextTick();

    expect(followingIds.value.size).toBe(0);
    expect(pendingUserIds.value.size).toBe(0);
  });

  it("clears state when the signed-in user changes to a different user", async () => {
    const { followingIds, pendingUserIds } = useFollowsInScope();
    followingIds.value = new Set(["user-2"]);
    pendingUserIds.value = new Set(["user-3"]);

    userRef.value = { id: "viewer-2" };
    await vue.nextTick();

    expect(followingIds.value.size).toBe(0);
    expect(pendingUserIds.value.size).toBe(0);
  });

  it("keeps state when the same user id is re-emitted", async () => {
    const { followingIds } = useFollowsInScope();
    followingIds.value = new Set(["user-2"]);

    userRef.value = { id: "viewer-1" };
    await vue.nextTick();

    expect(followingIds.value).toEqual(new Set(["user-2"]));
  });

  it("does not clear state on the initial signed-out to signed-in transition", async () => {
    userRef.value = null;
    const { followingIds } = useFollowsInScope();
    followingIds.value = new Set(["user-2"]);

    userRef.value = { id: "viewer-1" };
    await vue.nextTick();

    expect(followingIds.value).toEqual(new Set(["user-2"]));
  });

  it("ignores a fetchFollowing response that lands after the viewer changed", async () => {
    let resolveFetch!: (value: { followingIds: string[] }) => void;
    mockApiFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );
    const { fetchFollowing, followingIds } = useFollowsInScope();

    const inFlight = fetchFollowing();
    userRef.value = { id: "viewer-2" };
    resolveFetch({ followingIds: ["user-2"] });
    await inFlight;

    expect(followingIds.value.size).toBe(0);
  });

  it("ignores a follow that completes after the viewer signed out", async () => {
    let resolveFollow!: (value: unknown) => void;
    mockApiFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFollow = resolve;
      }),
    );
    const { toggleFollow, followingIds } = useFollowsInScope();

    const inFlight = toggleFollow("user-2");
    userRef.value = null;
    resolveFollow({ ok: true });
    await inFlight;

    expect(followingIds.value.size).toBe(0);
  });

  it("ignores an unfollow that completes after the viewer changed", async () => {
    let resolveUnfollow!: (value: unknown) => void;
    mockApiFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveUnfollow = resolve;
      }),
    );
    const { toggleFollow, followingIds } = useFollowsInScope();
    followingIds.value = new Set(["user-2"]);

    const inFlight = toggleFollow("user-2");
    userRef.value = { id: "viewer-2" };
    followingIds.value = new Set(["user-2", "user-9"]);
    resolveUnfollow({ ok: true });
    await inFlight;

    expect(followingIds.value).toEqual(new Set(["user-2", "user-9"]));
  });

  it("a stale toggle settling does not release the next viewer's pending guard", async () => {
    let resolveFirst!: (value: unknown) => void;
    mockApiFetch
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockReturnValueOnce(new Promise(() => {}));
    const { toggleFollow, isPending } = useFollowsInScope();

    const staleToggle = toggleFollow("user-2");
    userRef.value = null;
    userRef.value = { id: "viewer-2" };
    void toggleFollow("user-2");
    expect(isPending("user-2")).toBe(true);

    resolveFirst({ ok: true });
    await staleToggle;

    expect(isPending("user-2")).toBe(true);
  });
});
