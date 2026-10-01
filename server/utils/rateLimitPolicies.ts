import { createRouter } from "radix3";
import type { RateLimitPolicy } from "./rateLimitStore";

export const ONE_MINUTE_MS = 60_000;
export const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;

/**
 * Per-route rate limit policies, keyed by "<HTTP method> <route pattern>",
 * where the pattern uses Nitro's file-route syntax (`:id` for a dynamic
 * segment, `**` for a wildcard) — the same syntax `server/api/[id].get.ts`
 * compiles to. The middleware resolves each request's path to the pattern it
 * matches before looking up its policy (see
 * server/middleware/rateLimit.ts's `resolveRouteKey`), so a dynamic route is
 * metered per pattern, not per concrete id — `/api/entries/1` and
 * `/api/entries/2` share one bucket rather than minting a distinct key each.
 *
 * The middleware matches every request against this map, so adding a limit
 * to a new route is a one-line entry here — no route handler changes
 * required. A route with no entry is simply not rate-limited.
 *
 * One caveat when adding a DYNAMIC pattern: matching is per method, but each
 * method's matcher is built only from the patterns in this map, not the app's
 * full route table. So a dynamic pattern swallows any real static sibling
 * under the SAME method that has no policy of its own. Adding
 * `"GET /api/entries/:id"` makes `GET /api/entries/on-this-day` (a separate
 * static handler) resolve to `:id` and be metered under it. There is
 * currently no way to register a pattern for matching without also metering
 * it, so an unmetered exemption isn't expressible: either scope the dynamic
 * policy so metering the sibling is acceptable, give the sibling its own
 * (possibly generous) policy under that method, or don't add a dynamic policy
 * on that prefix. All three current policies are static paths, so this
 * doesn't bite today.
 *
 * Scoped to farflung#89's three named cost-metered/abuse-prone endpoints;
 * see each entry for why its limit and window were chosen. The pattern
 * matching exists so a future dynamic route can be added here and metered
 * correctly.
 */
export const RATE_LIMIT_POLICIES: Record<string, RateLimitPolicy> = {
  // Upload runs image dimension probing + thumbnail generation (sharp) and
  // writes a blob to storage — CPU and storage cost on every call. 20/minute
  // covers a bulk photo add (e.g. a trip recap) without letting a script
  // hammer the storage tier.
  "POST /api/media": { limit: 20, windowMs: ONE_MINUTE_MS },

  // Heaviest of the three: fetches the user's Instagram media, downloads
  // each photo from Instagram's CDN, and writes an entry+media+photo row per
  // item inside its own DB transaction. A user has no legitimate reason to
  // re-run this more than a couple of times an hour.
  "POST /api/connections/instagram/import": {
    limit: 3,
    windowMs: ONE_HOUR_MS,
  },

  // Runs a multi-table query (places/trips/entries/people) per call. Kept
  // generous relative to realistic debounced-typeahead usage while still
  // capping scripted scraping.
  "GET /api/search": { limit: 60, windowMs: ONE_MINUTE_MS },

  // Unauthenticated CSP violation collector (server/routes/csp-report.post.ts),
  // so it is metered per client IP. One page load can legitimately fire a
  // handful of reports; 60/minute absorbs that while capping Sentry spam.
  "POST /csp-report": { limit: 60, windowMs: ONE_MINUTE_MS },
};

/** Splits a policy key ("POST /api/media") into its method and route pattern. */
function splitPolicyKey(policyKey: string): {
  method: string;
  pattern: string;
} {
  const separatorIndex = policyKey.indexOf(" ");
  if (separatorIndex === -1) {
    throw new Error(
      `Rate limit policy key "${policyKey}" is missing the "<METHOD> <path>" space separator.`,
    );
  }
  return {
    method: policyKey.slice(0, separatorIndex),
    pattern: policyKey.slice(separatorIndex + 1),
  };
}

// Two patterns of the same shape but different param names (/api/trips/:id vs
// /api/trips/:tripId, or /api/proxy/** vs /api/proxy/**:rest) both insert the
// same placeholder/wildcard node; radix3's lookup keeps only one, so the
// other's policy would silently never apply. Collapsing param and wildcard
// names to a canonical token lets us detect that collision and fail loud
// instead — the same drift the policy tests guard against, caught at module
// load.
function routeShapeOf(routePattern: string): string {
  return routePattern
    .replace(/\*\*:?[^/]*/g, "**")
    .replace(/:[^/]+/g, ":param")
    .replace(/\/+$/, "");
}

/**
 * Resolves a request path to the route pattern it belongs to (or undefined
 * when it belongs to none). Returned as a closure over a prebuilt radix
 * router so matching is a tree lookup, not a per-request scan.
 */
export type RoutePatternMatcher = (path: string) => string | undefined;

/**
 * Builds a matcher over `routePatterns` using the same radix3 router Nitro
 * and h3 route requests with on Nuxt 4.x. That gives correct
 * static-over-dynamic
 * precedence (`/api/entries/on-this-day` wins over `/api/entries/:id`) and
 * trailing-slash normalization for free — the reason this defers to the
 * router instead of string-munching path segments. Isolated from the policy
 * map below so dynamic-pattern matching is unit-testable without a live
 * dynamic policy in production. Throws on two patterns that collide on shape
 * (see routeShapeOf).
 *
 * Coupling note: this parity holds only while h3 routes with radix3. h3 v2 /
 * Nitro v3 switch to `rou3`, so on a future Nuxt major keep this matcher on
 * whatever router h3 uses, or precedence and param syntax can diverge.
 */
export function buildRoutePatternMatcher(
  routePatterns: string[],
): RoutePatternMatcher {
  const router = createRouter<{ pattern: string }>();
  const shapeToPattern = new Map<string, string>();
  for (const pattern of routePatterns) {
    const shape = routeShapeOf(pattern);
    const collidingPattern = shapeToPattern.get(shape);
    if (collidingPattern) {
      throw new Error(
        `Rate limit route patterns "${collidingPattern}" and "${pattern}" collide; radix3 would silently match only one.`,
      );
    }
    shapeToPattern.set(shape, pattern);
    router.insert(pattern, { pattern });
  }
  return (path) => router.lookup(path)?.pattern;
}

// One matcher per HTTP method. Matching is method-aware so a policy on one
// method's route can't change what another method matches: a GET policy on a
// static sibling (/api/entries/on-this-day) must not un-meter a POST policy
// on the dynamic /api/entries/:id. Each method's patterns are unique (they're
// distinct RATE_LIMIT_POLICIES keys), so within a method the only collision
// left for buildRoutePatternMatcher to catch is a genuine shape clash.
function buildPolicyMatchersByMethod(): Map<string, RoutePatternMatcher> {
  const patternsByMethod = new Map<string, string[]>();
  for (const policyKey of Object.keys(RATE_LIMIT_POLICIES)) {
    const { method, pattern } = splitPolicyKey(policyKey);
    const patterns = patternsByMethod.get(method) ?? [];
    patterns.push(pattern);
    patternsByMethod.set(method, patterns);
  }

  const matchersByMethod = new Map<string, RoutePatternMatcher>();
  for (const [method, patterns] of patternsByMethod) {
    matchersByMethod.set(method, buildRoutePatternMatcher(patterns));
  }
  return matchersByMethod;
}

const policyMatchersByMethod = buildPolicyMatchersByMethod();

/** Resolves a request's method+path to the policied route pattern it matches, or undefined. */
export function matchPolicyRoutePattern(
  method: string,
  path: string,
): string | undefined {
  return policyMatchersByMethod.get(method)?.(path);
}
