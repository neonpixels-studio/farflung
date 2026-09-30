/**
 * Fixed-window rate limit counter.
 *
 * BEST-EFFORT ONLY — this runs on Netlify serverless functions, where each
 * concurrent instance holds its own process memory, so a client landing on
 * more than one warm instance can exceed the nominal limit. Accepted as a
 * first pass for farflung#89; a shared store (Postgres table, Upstash
 * Redis) is the natural next step behind this same RateLimitStore shape.
 *
 * Fixed windows also allow a boundary burst — up to 2x `limit` requests in a
 * short span straddling a window boundary. Inherent to the algorithm and
 * accepted here; a sliding-window log would remove it at the cost of
 * unbounded per-key memory.
 */

// How often consume() triggers a sweep for stale windows; a pure cost-control
// knob, unrelated to any policy's window length. Exported so tests assert
// against the real value instead of a hardcoded copy that could silently
// drift out of sync.
export const CLEANUP_INTERVAL_MS = 5 * 60_000;

// A window is evicted once untouched for this many multiples of its OWN
// policy's windowMs (staleness is per-key, not a single global horizon).
const CLEANUP_SAFETY_MULTIPLIER = 2;

// Backstop against unbounded growth between time-gated sweeps (e.g. an
// IP-keyed policy facing many distinct callers in a burst). Once the map
// reaches this size, a sweep runs on every consume() regardless of the
// interval gate. Exported for the same reason as CLEANUP_INTERVAL_MS above.
export const MAX_TRACKED_WINDOWS = 10_000;

// When the cap is hit and the staleness sweep alone can't bring the map back
// under it (every key is still genuinely live), eviction targets this
// fraction of the cap rather than trimming to just one under it. Otherwise a
// caller who can mint distinct keys (e.g. via the IP-keyed anonymous
// fallback) pins the map at the cap and forces every subsequent consume()
// back through this same at-cap path — evicting a batch instead makes that
// path recur only once per (1 - this fraction) * MAX_TRACKED_WINDOWS new
// keys, not on every request. Exported for the same reason as
// CLEANUP_INTERVAL_MS above.
export const EVICTION_TARGET_LOAD_FACTOR = 0.9;

export interface RateLimitPolicy {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Epoch ms when the current window resets. */
  resetAt: number;
}

interface WindowState {
  count: number;
  windowStart: number;
  /** The windowMs this window was opened with, so cleanup can size its own staleness horizon per key. */
  windowMs: number;
}

export class RateLimitStore {
  private readonly windows = new Map<string, WindowState>();
  private lastCleanupAt = 0;

  /** Number of distinct keys currently tracked; exposed so tests can verify cleanup directly. */
  get windowCount(): number {
    return this.windows.size;
  }

  /**
   * Records one request against `key` under `policy` and reports whether it
   * is within the limit. `now` defaults to Date.now(), overridden by tests.
   */
  consume(
    key: string,
    policy: RateLimitPolicy,
    now: number = Date.now(),
  ): RateLimitResult {
    this.cleanupStaleWindows(now);

    const state = this.currentWindowFor(key, policy, now);
    state.count += 1;
    this.touchKey(key, state);

    return {
      allowed: state.count <= policy.limit,
      limit: policy.limit,
      remaining: Math.max(policy.limit - state.count, 0),
      resetAt: state.windowStart + policy.windowMs,
    };
  }

  // Map#set on a key that already exists updates its value in place without
  // moving it in iteration order. Deleting first before re-inserting moves
  // it to the end instead, so the map's iteration order tracks recency of
  // use (oldest-touched first) — the eviction fallback below relies on this
  // to find the least-recently-touched keys without sorting the whole map.
  private touchKey(key: string, state: WindowState): void {
    this.windows.delete(key);
    this.windows.set(key, state);
  }

  private currentWindowFor(
    key: string,
    policy: RateLimitPolicy,
    now: number,
  ): WindowState {
    const existing = this.windows.get(key);
    const windowHasExpired =
      !existing || now - existing.windowStart >= policy.windowMs;

    if (windowHasExpired) {
      return { count: 0, windowStart: now, windowMs: policy.windowMs };
    }
    return existing;
  }

  private cleanupStaleWindows(now: number): void {
    const cleanupIsDue = now - this.lastCleanupAt >= CLEANUP_INTERVAL_MS;
    const capExceeded = this.windows.size >= MAX_TRACKED_WINDOWS;
    if (!cleanupIsDue && !capExceeded) {
      return;
    }
    this.lastCleanupAt = now;

    for (const [key, state] of this.windows) {
      const staleAfterMs = CLEANUP_SAFETY_MULTIPLIER * state.windowMs;
      const isStale = now - state.windowStart >= staleAfterMs;
      if (!isStale) {
        continue;
      }
      this.windows.delete(key);
    }

    this.evictLeastRecentlyTouchedIfStillOverCap();
  }

  // Staleness sweep alone can leave the map at/over the cap if enough keys
  // are still genuinely live. Evicting the least-recently-touched keys here
  // is a deliberate fail-open (resets those callers' counters early) rather
  // than letting memory and per-request scan cost grow without bound. Reads
  // directly off Map iteration order (see touchKey above) instead of
  // sorting, and trims to EVICTION_TARGET_LOAD_FACTOR of the cap rather than
  // just one under it, so this runs only occasionally rather than on every
  // request while a caller keeps the store pinned at the cap.
  private evictLeastRecentlyTouchedIfStillOverCap(): void {
    if (this.windows.size < MAX_TRACKED_WINDOWS) {
      return;
    }
    const targetSize = Math.floor(
      MAX_TRACKED_WINDOWS * EVICTION_TARGET_LOAD_FACTOR,
    );
    const excess = this.windows.size - targetSize;
    const oldestFirst = this.windows.keys();
    for (let evicted = 0; evicted < excess; evicted += 1) {
      const next = oldestFirst.next();
      if (next.done) {
        break;
      }
      this.windows.delete(next.value);
    }
  }
}
