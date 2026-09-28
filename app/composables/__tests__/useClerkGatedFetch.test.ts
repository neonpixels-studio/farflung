import { describe, it, expect, vi, afterEach } from "vitest";
import { ref, nextTick, effectScope, computed } from "vue";
import {
  useClerkGatedFetch,
  CLERK_BOOTSTRAP_TIMEOUT_MS,
} from "../useClerkGatedFetch";

describe("useClerkGatedFetch", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls fetchFn synchronously when Clerk has already resolved", () => {
    const isClerkLoaded = ref(true);
    const canRetryAuthenticated = ref(true);
    const { gate } = useClerkGatedFetch(isClerkLoaded, canRetryAuthenticated);
    const fetchFn = vi.fn().mockResolvedValue("result");

    const resultPromise = gate(fetchFn);

    // Synchronous, not deferred behind a microtask: a caller that relies on
    // this firing within the same tick as useAsyncData's own immediate call
    // (see guides/[id].vue and trips/[id].vue) must not be broken by an
    // unnecessary await here.
    expect(fetchFn).toHaveBeenCalledTimes(1);
    // gate()'s own promise always resolves `true`, never fetchFn's own
    // resolved value — see the "always resolves to a defined, non-undefined
    // value" test below for why.
    return expect(resultPromise).resolves.toBe(true);
  });

  it("does not call fetchFn while Clerk has not resolved yet", () => {
    const isClerkLoaded = ref(false);
    const canRetryAuthenticated = ref(false);
    const { gate } = useClerkGatedFetch(isClerkLoaded, canRetryAuthenticated);
    const fetchFn = vi.fn().mockResolvedValue("result");

    gate(fetchFn);

    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("calls fetchFn and settles the same promise once isClerkLoaded resolves", async () => {
    const isClerkLoaded = ref(false);
    const canRetryAuthenticated = ref(false);
    const { gate } = useClerkGatedFetch(isClerkLoaded, canRetryAuthenticated);
    const fetchFn = vi.fn().mockResolvedValue("result");

    const resultPromise = gate(fetchFn);
    isClerkLoaded.value = true;
    await nextTick();

    expect(fetchFn).toHaveBeenCalledTimes(1);
    await expect(resultPromise).resolves.toBe(true);
  });

  it("fires fetchFn anonymously after the bootstrap grace period if isClerkLoaded never resolves", async () => {
    vi.useFakeTimers();
    const isClerkLoaded = ref(false);
    const canRetryAuthenticated = ref(false);
    const { gate } = useClerkGatedFetch(isClerkLoaded, canRetryAuthenticated);
    const fetchFn = vi.fn().mockResolvedValue("result");

    const resultPromise = gate(fetchFn);
    expect(fetchFn).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(CLERK_BOOTSTRAP_TIMEOUT_MS);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    await expect(resultPromise).resolves.toBe(true);
  });

  it("does not fire the grace-period fallback once isClerkLoaded resolves first", async () => {
    vi.useFakeTimers();
    const isClerkLoaded = ref(false);
    const canRetryAuthenticated = ref(false);
    const { gate } = useClerkGatedFetch(isClerkLoaded, canRetryAuthenticated);
    const fetchFn = vi.fn().mockResolvedValue("result");

    gate(fetchFn);
    isClerkLoaded.value = true;
    await nextTick();
    await vi.advanceTimersByTimeAsync(CLERK_BOOTSTRAP_TIMEOUT_MS);

    // The gate's own resolution already fired fetchFn once (see the previous
    // test); the grace period lapsing afterward must not fire it again.
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("supersedes a still-pending gate rather than letting both eventually fire", async () => {
    // Regression guard: navigating between two ids while Clerk is still
    // resolving (e.g. guide A -> guide B) must not leave guide A's gate
    // pending — its eventual timeout would otherwise call fetchFnA for a
    // resource the app has already navigated away from.
    vi.useFakeTimers();
    const isClerkLoaded = ref(false);
    const canRetryAuthenticated = ref(false);
    const { gate } = useClerkGatedFetch(isClerkLoaded, canRetryAuthenticated);
    const fetchFnA = vi.fn().mockResolvedValue("a");
    const fetchFnB = vi.fn().mockResolvedValue("b");

    gate(fetchFnA);
    gate(fetchFnB);

    await vi.advanceTimersByTimeAsync(CLERK_BOOTSTRAP_TIMEOUT_MS);

    expect(fetchFnA).not.toHaveBeenCalled();
    expect(fetchFnB).toHaveBeenCalledTimes(1);
  });

  it("does not count the auth resolution that produced the gate's own fetch as a retry", async () => {
    // The gate only starts watching for retries once it settles, specifically
    // so the same canRetryAuthenticated change that just resolved the gate
    // (a signed-in owner's isLoaded/isSignedIn flipping together) doesn't
    // also increment retryGeneration and trigger a redundant duplicate fetch.
    const isClerkLoaded = ref(false);
    const isSignedIn = ref(false);
    const canRetryAuthenticated = computed(
      () => isClerkLoaded.value && isSignedIn.value,
    );
    const { gate, retryGeneration } = useClerkGatedFetch(
      isClerkLoaded,
      canRetryAuthenticated,
    );
    const fetchFn = vi.fn().mockResolvedValue("result");

    gate(fetchFn);
    isSignedIn.value = true;
    isClerkLoaded.value = true;
    await nextTick();

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(retryGeneration.value).toBe(0);
  });

  it("increments retryGeneration for a canRetryAuthenticated change after the gate has already settled", async () => {
    const isClerkLoaded = ref(true);
    const isSignedIn = ref(false);
    const canRetryAuthenticated = computed(
      () => isClerkLoaded.value && isSignedIn.value,
    );
    const { gate, retryGeneration } = useClerkGatedFetch(
      isClerkLoaded,
      canRetryAuthenticated,
    );
    const fetchFn = vi.fn().mockResolvedValue("result");

    gate(fetchFn);
    expect(retryGeneration.value).toBe(0);

    isSignedIn.value = true;
    await nextTick();

    expect(retryGeneration.value).toBe(1);
  });

  // #289: with `server: true`, a signed-in owner's initial load can resolve
  // entirely during SSR; Nuxt then reuses that SSR payload on hydration and
  // never invokes the caller's useAsyncData handler (and therefore never
  // calls gate()) client-side for that first load. Without a fallback,
  // nothing would ever start watching canRetryAuthenticated, so the owner's
  // session resolving afterward would never trigger the authenticated retry
  // (see guides/[id].vue, trips/[id].vue, u/[id].vue).
  it("starts watching for retries even if gate() is never called on the client", async () => {
    const isClerkLoaded = ref(false);
    const isSignedIn = ref(false);
    const canRetryAuthenticated = computed(
      () => isClerkLoaded.value && isSignedIn.value,
    );
    const { retryGeneration } = useClerkGatedFetch(
      isClerkLoaded,
      canRetryAuthenticated,
    );

    // gate() is deliberately never called — simulating the SSR-payload-reuse
    // case above.
    await nextTick();

    isClerkLoaded.value = true;
    isSignedIn.value = true;
    await nextTick();

    expect(retryGeneration.value).toBe(1);
  });

  it("does not start the retry-watch fallback once gate() has already run, even while still pending (no double registration)", async () => {
    // Regression guard for the fallback above, using the case it must NOT
    // act on: gate() called while Clerk hasn't resolved yet (the deferred
    // branch), left pending across a tick (so the fallback's own nextTick
    // check definitely runs first), and only then resolved. If the fallback
    // wrongly started its own watch here, Clerk resolving would be caught by
    // BOTH that watch and gate()'s own settle() — incrementing
    // retryGeneration to 1 in addition to firing fetchFn, exactly the
    // redundant duplicate this design exists to prevent (see "does not count
    // the auth resolution that produced the gate's own fetch as a retry"
    // above, which covers the same guarantee without the intervening tick).
    const isClerkLoaded = ref(false);
    const isSignedIn = ref(false);
    const canRetryAuthenticated = computed(
      () => isClerkLoaded.value && isSignedIn.value,
    );
    const { gate, retryGeneration } = useClerkGatedFetch(
      isClerkLoaded,
      canRetryAuthenticated,
    );
    const fetchFn = vi.fn().mockResolvedValue("result");
    gate(fetchFn);

    // Let the fallback's own nextTick check run first; it must see gate()
    // already ran (hasGateRun) and no-op, leaving gate()'s own deferred
    // settle() as the only thing that will ever start the retry watch.
    await nextTick();
    expect(fetchFn).not.toHaveBeenCalled();

    isSignedIn.value = true;
    isClerkLoaded.value = true;
    await nextTick();

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(retryGeneration.value).toBe(0);
  });

  it("never starts the retry-watch fallback if the scope is disposed before it runs", async () => {
    // Regression guard: a page that unmounts in the same tick it mounted
    // (e.g. an instant route change) must not leave the fallback's watch
    // running for a canRetryAuthenticated ref the torn-down page no longer
    // cares about.
    const isClerkLoaded = ref(false);
    const isSignedIn = ref(false);
    const canRetryAuthenticated = computed(
      () => isClerkLoaded.value && isSignedIn.value,
    );
    const scope = effectScope();
    const retryGeneration = scope.run(() => {
      // gate() deliberately never called, mirroring the SSR-reuse case the
      // fallback targets.
      return useClerkGatedFetch(isClerkLoaded, canRetryAuthenticated)
        .retryGeneration;
    })!;
    scope.stop();

    await nextTick();
    isClerkLoaded.value = true;
    isSignedIn.value = true;
    await nextTick();

    expect(retryGeneration.value).toBe(0);
  });

  it("stops the retry-watch fallback's own watcher on scope disposal after it has started", async () => {
    // Regression guard for the other teardown ordering: the scope disposes
    // *after* the fallback's nextTick has already started watching (the more
    // common real-world case — a page mounted for a while, then navigated
    // away from, before Clerk ever resolved).
    const isClerkLoaded = ref(false);
    const isSignedIn = ref(false);
    const canRetryAuthenticated = computed(
      () => isClerkLoaded.value && isSignedIn.value,
    );
    const scope = effectScope();
    const retryGeneration = scope.run(() => {
      return useClerkGatedFetch(isClerkLoaded, canRetryAuthenticated)
        .retryGeneration;
    })!;

    // Let the fallback's nextTick fire and start its watch before disposing.
    await nextTick();
    scope.stop();

    isClerkLoaded.value = true;
    isSignedIn.value = true;
    await nextTick();

    expect(retryGeneration.value).toBe(0);
  });

  it("clears a pending timer/watch on scope disposal so a torn-down page's fetch never fires later", async () => {
    // Regression guard: without this cleanup, a gate() call left pending when
    // a page unmounts (e.g. the visitor navigates away before Clerk resolves)
    // would still fire fetchFn once the grace period lapses, writing into
    // whatever shared store state a since-mounted, unrelated page now reads.
    vi.useFakeTimers();
    const isClerkLoaded = ref(false);
    const canRetryAuthenticated = ref(false);
    const fetchFn = vi.fn().mockResolvedValue("result");
    const scope = effectScope();

    scope.run(() => {
      const { gate } = useClerkGatedFetch(isClerkLoaded, canRetryAuthenticated);
      gate(fetchFn);
    });
    scope.stop();

    await vi.advanceTimersByTimeAsync(CLERK_BOOTSTRAP_TIMEOUT_MS);

    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("propagates a rejection from the grace-period fallback", async () => {
    vi.useFakeTimers();
    const isClerkLoaded = ref(false);
    const canRetryAuthenticated = ref(false);
    const { gate } = useClerkGatedFetch(isClerkLoaded, canRetryAuthenticated);
    const fetchFn = vi.fn().mockRejectedValue(new Error("network error"));

    const resultPromise = gate(fetchFn);
    resultPromise.catch(() => {});
    await vi.advanceTimersByTimeAsync(CLERK_BOOTSTRAP_TIMEOUT_MS);

    await expect(resultPromise).rejects.toThrow("network error");
  });

  // #289: with `server: true`, Nuxt only reuses an SSR-fetched payload on
  // hydration (instead of silently re-running the handler client-side and
  // duplicating the request every visitor's browser just watched the server
  // make) when useAsyncData's own `data` is not `undefined`. Centralizing
  // this in gate() itself, rather than trusting every caller to remember
  // `.then(() => true)`, is what this test protects.
  it("always resolves to true, regardless of what fetchFn itself resolves to", async () => {
    const isClerkLoaded = ref(true);
    const canRetryAuthenticated = ref(true);
    const { gate } = useClerkGatedFetch(isClerkLoaded, canRetryAuthenticated);

    await expect(gate(() => Promise.resolve(undefined))).resolves.toBe(true);
    await expect(gate(() => Promise.resolve(null))).resolves.toBe(true);
    await expect(gate(() => Promise.resolve("some data"))).resolves.toBe(true);
  });

  // #289: `import.meta.server` is fixed per-module at build time by Nuxt's
  // own macro replacement, so it can't be toggled from this test file — the
  // injectable `isServer` param exists specifically so this branch (the
  // mechanism that lets a non-JS crawler's SSR pass see real page data
  // instead of hanging for CLERK_BOOTSTRAP_TIMEOUT_MS) has real coverage.
  it("fires fetchFn immediately when isServer is true, without waiting for isClerkLoaded or scheduling a timer", () => {
    const isClerkLoaded = ref(false);
    const canRetryAuthenticated = ref(false);
    const { gate } = useClerkGatedFetch(
      isClerkLoaded,
      canRetryAuthenticated,
      true,
    );
    const fetchFn = vi.fn().mockResolvedValue("result");

    vi.useFakeTimers();
    const resultPromise = gate(fetchFn);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    return expect(resultPromise).resolves.toBe(true);
  });

  // Regression guard for the retry-watch fallback: a plain (non-immediate)
  // `watch()` only fires on a *change*, so if the viewer's auth has already
  // resolved by the time the fallback's nextTick runs (e.g. a warm Clerk
  // session), there is no further transition left for it to catch — without
  // the immediate check, nothing would ever bump retryGeneration and the
  // owner would be stuck on whatever the (anonymous) SSR pass rendered.
  it("immediately triggers a retry if canRetryAuthenticated is already true when the fallback runs", async () => {
    const isClerkLoaded = ref(true);
    const isSignedIn = ref(true);
    const canRetryAuthenticated = computed(
      () => isClerkLoaded.value && isSignedIn.value,
    );
    const { retryGeneration } = useClerkGatedFetch(
      isClerkLoaded,
      canRetryAuthenticated,
    );

    // gate() is deliberately never called — simulating the SSR-payload-reuse
    // case the fallback targets, but where Clerk had *already* resolved
    // (signed in) by the time the client mounted.
    await nextTick();

    expect(retryGeneration.value).toBe(1);
  });
});
