import type { H3Event } from "h3";
import {
  RATE_LIMIT_POLICIES,
  matchPolicyRoutePattern,
} from "../utils/rateLimitPolicies";
import { RateLimitStore } from "../utils/rateLimitStore";
import type { RateLimitResult } from "../utils/rateLimitStore";

// Composition root wiring the generic RateLimitStore up to the policy map.
const rateLimitStore = new RateLimitStore();

// Netlify's edge sets this to the caller's true IP and it can't be
// client-overridden, unlike X-Forwarded-For — but only when a Netlify edge
// actually sits in front of the request, so it's gated on an explicit,
// app-owned flag rather than trusted unconditionally (spoofable off-platform)
// or inferred from a generic-looking env var another host/tool could also
// set. NETLIFY=true is a Netlify *build*-time variable only — it is not
// injected into the Functions runtime, so it can't be used to detect this at
// request time either; TRUST_NETLIFY_CLIENT_IP is set in the encrypted env file
// and inlined at build by nitro.replace in nuxt.config.ts (see .env.example).
const NETLIFY_CLIENT_IP_HEADER = "x-nf-client-connection-ip";
const isTrustedNetlifyDeployment = (): boolean =>
  process.env.TRUST_NETLIFY_CLIENT_IP === "true";

// Shared bucket for the rare case neither a user nor an IP can be resolved
// (see resolveIdentifier below). Every policied route currently requires a
// bearer token (auth.ts throws its own 401 first), so this branch is
// unreachable today — it exists only to guard a future unauthenticated
// policy entry. Warns once per process rather than per request so that if it
// ever becomes reachable, an identity-less caller can't use it to flood logs.
const ANONYMOUS_IDENTIFIER = "anonymous";
let hasWarnedAboutAnonymousBucket = false;

// Runs after server/middleware/auth.ts (Nitro runs server/middleware/*
// alphabetically), so for every policied route below, event.context.userId
// is already set — auth.ts throws its own 401 first if the token is invalid.
//
// Global middleware runs before h3's router matches the route, so
// `event.context.matchedRoute` isn't populated yet here; we match the path
// against the policied route patterns ourselves via the same radix router
// h3 uses (see rateLimitPolicies.ts). Keying on the matched pattern rather
// than the raw path means a dynamic route meters per pattern, not per id, so
// it can't be evaded by enumerating ids. Returns null when the path matches
// no policied pattern for this method.
function resolveRouteKey(event: H3Event): string | null {
  // h3 falls back to a route's GET handler for HEAD requests with no HEAD
  // handler registered, so HEAD must be normalized to GET to stay metered
  // (and to select the GET matcher below).
  const method = event.method === "HEAD" ? "GET" : event.method;
  // matchPolicyRoutePattern normalizes a trailing slash the same way h3's
  // router does (both radix3), so the set of paths metered here is exactly
  // the set h3 routes to a handler. A path h3 won't route (e.g. a doubled
  // trailing slash) matches nothing here and stays unmetered, since it does
  // no handler work to abuse.
  const [pathWithoutQuery = ""] = event.path.split("?");
  const pattern = matchPolicyRoutePattern(method, pathWithoutQuery);
  if (!pattern) {
    return null;
  }
  return `${method} ${pattern}`;
}

/** Prefers Netlify's client-IP header over the raw socket address `getRequestIP` falls back to. */
function resolveClientIp(event: H3Event): string | null {
  const netlifyClientIp = isTrustedNetlifyDeployment()
    ? getHeader(event, NETLIFY_CLIENT_IP_HEADER)
    : undefined;
  if (netlifyClientIp) {
    return netlifyClientIp;
  }
  return getRequestIP(event) ?? null;
}

/**
 * Identifies the caller for rate-limit bucketing: the authenticated user in
 * practice (all three policied routes require a bearer token), falling back
 * to IP to guard a future unauthenticated policy entry, then to one shared
 * "anonymous" bucket (logged — it means the limit is no longer per-caller).
 */
function resolveIdentifier(event: H3Event): string {
  if (event.context.userId) {
    return `user:${event.context.userId}`;
  }
  const clientIp = resolveClientIp(event);
  if (clientIp) {
    return `ip:${clientIp}`;
  }
  if (!hasWarnedAboutAnonymousBucket) {
    hasWarnedAboutAnonymousBucket = true;
    console.warn(
      `rateLimit: no user or IP for ${event.method} ${event.path}; using the shared anonymous bucket (further occurrences are not logged)`,
    );
  }
  return ANONYMOUS_IDENTIFIER;
}

function secondsUntil(epochMs: number, now: number): number {
  return Math.max(Math.ceil((epochMs - now) / 1000), 0);
}

function applyRateLimitHeaders(event: H3Event, result: RateLimitResult): void {
  const now = Date.now();
  setResponseHeader(event, "RateLimit-Limit", String(result.limit));
  setResponseHeader(event, "RateLimit-Remaining", String(result.remaining));
  setResponseHeader(
    event,
    "RateLimit-Reset",
    String(secondsUntil(result.resetAt, now)),
  );

  if (result.allowed) {
    return;
  }
  setResponseHeader(event, "Retry-After", secondsUntil(result.resetAt, now));
}

export default defineEventHandler((event) => {
  const routeKey = resolveRouteKey(event);
  if (!routeKey) {
    return;
  }
  const policy = RATE_LIMIT_POLICIES[routeKey];
  if (!policy) {
    return;
  }

  const identifier = resolveIdentifier(event);
  const result = rateLimitStore.consume(`${routeKey}:${identifier}`, policy);
  applyRateLimitHeaders(event, result);

  if (result.allowed) {
    return;
  }
  throw createError({ statusCode: 429, statusMessage: "Too Many Requests" });
});
