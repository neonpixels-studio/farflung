/**
 * Withholds a fetch until Clerk's local bootstrap resolves, so it doesn't
 * fire anonymously while auth is still resolving (#255) — a signed-in
 * owner's first request then already carries a token, since Clerk resolves
 * isLoaded and isSignedIn together (same contract as useEntryDraft's
 * onDraftReady). Bounded by CLERK_BOOTSTRAP_TIMEOUT_MS so a public resource
 * still loads anonymously if Clerk's script never resolves at all (blocked
 * by an ad blocker, a flaky CDN) — exactly the immediate anonymous fetch
 * this fix defers, just capped rather than instant.
 *
 * Usage — pass `isClerkLoaded` and the caller's own `canRetryAuthenticated`
 * (both from its `useClerkAuth()`), and watch `retryGeneration` instead of
 * `canRetryAuthenticated` directly:
 *
 *   const { gate, retryGeneration } = useClerkGatedFetch(isClerkLoaded, canRetryAuthenticated);
 *   useAsyncData(key, () => gate(() => store.fetchById(id.value)),
 *     { server: false, watch: [id, retryGeneration] });
 *
 * `gate()` always calls `fetchFn` itself and settles the promise it returns
 * with the real result — the caller never needs to re-invoke it, so
 * `useAsyncData` never sees a promise that goes permanently unresolved.
 * `retryGeneration` only increments for a `canRetryAuthenticated` change
 * *after* the gate has already concluded once: the gate doesn't start
 * watching for retries until it settles, so the very same auth resolution
 * that produced the gate's own (already-correct) request never also
 * increments `retryGeneration` and triggers a redundant duplicate.
 *
 * `gate()`'s own promise always resolves to `true` (never passes through
 * whatever `fetchFn` itself resolved to, including `undefined`): with
 * `server: true` (#289), Nuxt only reuses an SSR-fetched payload on
 * hydration — instead of silently re-running the handler client-side and
 * duplicating the request every visitor's browser just watched the server
 * make — when useAsyncData's own `data` is not `undefined`. Centralizing
 * this here means every caller gets it for free, rather than each of the
 * three pages using this composable needing its own `.then(() => true)`.
 *
 * With `server: true`, `gate()` also runs during SSR, where it always
 * resolves immediately and anonymously (see the `isServer` branch below).
 * Because of the guarantee above, that SSR-fetched payload is always reused
 * on hydration, so `gate()` is deterministically never called client-side
 * during that initial load — meaning nothing would ever start watching
 * `canRetryAuthenticated` for a signed-in owner's retry. The one-time
 * `nextTick` fallback below covers exactly that gap: if nothing called
 * `gate()` by the end of the current synchronous setup, it starts the retry
 * watch itself — and if the viewer's auth has *already* resolved by then
 * (e.g. a warm Clerk session), it fires the retry immediately rather than
 * waiting on a `canRetryAuthenticated` change event that will never come
 * (there's nothing left to transition from).
 */
export const CLERK_BOOTSTRAP_TIMEOUT_MS = 2000;

export function useClerkGatedFetch(
  isClerkLoaded: Ref<boolean>,
  canRetryAuthenticated: Ref<boolean> | ComputedRef<boolean>,
  // Defaults to the real compile-time flag. Overridable so a test can
  // exercise the server fast-path directly: import.meta.server is fixed
  // per-module at build time by Nuxt's own macro replacement and can't be
  // toggled from a test file importing this module.
  isServer: boolean = import.meta.server,
) {
  // Every withheld gate() call registers its timer/watch pair here so a
  // component teardown — or a newer gate() call superseding an older one
  // (e.g. the route id changing while Clerk is still resolving) — can clear
  // it. Left unhandled, an orphaned timer outlives the page/id that started
  // it and, once it fires, calls fetchFn for a resource the app has already
  // navigated away from, overwriting shared store state a since-mounted,
  // unrelated page then reads.
  const pendingCleanups = new Set<() => void>();

  const retryGeneration = ref(0);
  let stopWatchingForRetries: (() => void) | null = null;
  let isDisposed = false;

  // Whether *any* gate() call has run yet during this setup. Checked by the
  // nextTick fallback below — see its own comment for why this exists.
  let hasGateRun = false;

  if (getCurrentScope()) {
    onScopeDispose(() => {
      isDisposed = true;
      pendingCleanups.forEach((cleanup) => cleanup());
      pendingCleanups.clear();
      stopWatchingForRetries?.();
    });
  }

  // Starts (once) only after the gate this call belongs to has concluded, so
  // the auth state that just produced this gate's own request can't also be
  // the "change" that triggers a retry of it.
  function startWatchingForRetries(): void {
    if (stopWatchingForRetries) {
      return;
    }
    stopWatchingForRetries = watch(canRetryAuthenticated, () => {
      retryGeneration.value += 1;
    });
  }

  // Fallback for the SSR-then-hydration-reuse gap (see the doc comment
  // above): deferred past the current synchronous setup (when the caller's
  // useAsyncData handler — and therefore gate() — normally runs, if it runs
  // at all) so it only ever acts when nothing else already did.
  // startWatchingForRetries() is itself idempotent, so this is a no-op
  // whenever gate() ran for real; `isDisposed` guards the rare case where the
  // component/scope tore down before this microtask fired.
  nextTick(() => {
    if (isDisposed || hasGateRun) {
      return;
    }
    startWatchingForRetries();
    // The watch above only fires on a *change* — if the viewer's auth has
    // already resolved by this point (a warm/fast Clerk session), there is
    // no further transition left to catch, so nothing would ever trigger the
    // authenticated retry the owner needs. Fire it once, directly, instead.
    if (canRetryAuthenticated.value) {
      retryGeneration.value += 1;
    }
  });

  function gate<FetchResult>(
    fetchFn: () => Promise<FetchResult>,
  ): Promise<true> {
    hasGateRun = true;
    pendingCleanups.forEach((cleanup) => cleanup());

    // Clerk's server middleware is disabled fleet-wide (skipServerMiddleware,
    // see nuxt.config.ts), so isClerkLoaded can only ever be false during SSR
    // — nothing there will ever flip it true, and without this the branch
    // below would block every server-rendered page for the full
    // CLERK_BOOTSTRAP_TIMEOUT_MS on every request. The token can never attach
    // server-side either way (apiFetch's getToken resolves to null there, see
    // useApiClient), so firing immediately is exactly what that timeout
    // branch would eventually produce anyway, just without the wait — this
    // is what lets a non-JS crawler's SSR pass see real per-page data instead
    // of the generic fallback (#289).
    if (isServer) {
      return fetchFn().then(() => true);
    }

    if (isClerkLoaded.value) {
      startWatchingForRetries();
      return fetchFn().then(() => true);
    }

    return new Promise<true>((resolve, reject) => {
      const cleanup = (): void => {
        clearTimeout(timeoutId);
        stopWatchingClerkLoaded();
        pendingCleanups.delete(cleanup);
      };

      const settle = (): void => {
        cleanup();
        startWatchingForRetries();
        fetchFn().then(() => resolve(true), reject);
      };

      const timeoutId = setTimeout(settle, CLERK_BOOTSTRAP_TIMEOUT_MS);

      const stopWatchingClerkLoaded = watch(isClerkLoaded, (loaded) => {
        if (!loaded) {
          return;
        }
        settle();
      });

      pendingCleanups.add(cleanup);
    });
  }

  return { gate, retryGeneration };
}
