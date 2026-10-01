/**
 * End-to-end guard for the dynamic-route fix (farflung#125): with a dynamic
 * policy configured, the middleware must meter every concrete id under the
 * one matched pattern, so an attacker can't dodge the limit by walking ids.
 * Also pins the method-aware matching: a policy on one method's route can't
 * change what another method matches.
 *
 * The policy map and its matcher are mocked (RATE_LIMIT_POLICIES currently
 * ships only static routes, and the drift guard pins that set) while the real
 * buildRoutePatternMatcher does the matching, so this exercises the actual
 * radix matching wired through the real middleware.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { stubNitroGlobals } from "./test-utils";

stubNitroGlobals();

const ONE_MINUTE_MS = 60_000;
const STATIC_GET_POLICY = { limit: 30, windowMs: ONE_MINUTE_MS };
const DYNAMIC_POST_POLICY = { limit: 10, windowMs: ONE_MINUTE_MS };

const { mockConsume } = vi.hoisted(() => ({ mockConsume: vi.fn() }));

vi.mock("../../server/utils/rateLimitStore", () => ({
  RateLimitStore: vi.fn().mockImplementation(function MockRateLimitStore() {
    return { consume: mockConsume };
  }),
}));

// A GET static sibling next to a POST dynamic route on the same prefix — the
// exact shape that would mis-meter if matching ignored the method.
vi.mock("../../server/utils/rateLimitPolicies", async () => {
  const actual = await vi.importActual<
    typeof import("../../server/utils/rateLimitPolicies")
  >("../../server/utils/rateLimitPolicies");
  const matchersByMethod = new Map([
    ["GET", actual.buildRoutePatternMatcher(["/api/entries/on-this-day"])],
    ["POST", actual.buildRoutePatternMatcher(["/api/entries/:id"])],
  ]);
  return {
    ...actual,
    RATE_LIMIT_POLICIES: {
      "GET /api/entries/on-this-day": STATIC_GET_POLICY,
      "POST /api/entries/:id": DYNAMIC_POST_POLICY,
    },
    matchPolicyRoutePattern: (method: string, path: string) =>
      matchersByMethod.get(method)?.(path),
  };
});

Object.assign(globalThis, {
  setResponseHeader: vi.fn(),
  getRequestIP: vi.fn(() => undefined),
  getHeader: vi.fn(() => undefined),
});

const { default: rateLimitMiddleware } =
  await import("../../server/middleware/rateLimit");

interface FakeEvent {
  path: string;
  method: string;
  context: { userId?: string };
}

function buildEvent(path: string, method: string, userId?: string): FakeEvent {
  return { path, method, context: { userId } };
}

const FIXED_NOW = 1_700_000_000_000;

describe("rate limit middleware — dynamic routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsume.mockReturnValue({
      allowed: true,
      limit: DYNAMIC_POST_POLICY.limit,
      remaining: DYNAMIC_POST_POLICY.limit - 1,
      resetAt: FIXED_NOW + ONE_MINUTE_MS,
    });
  });

  it("meters two different ids under the one matched pattern bucket", () => {
    rateLimitMiddleware(
      buildEvent("/api/entries/1", "POST", "user-1") as never,
    );
    rateLimitMiddleware(
      buildEvent("/api/entries/2", "POST", "user-1") as never,
    );

    // Same route-key portion for both ids: the enumeration hole in #125 is
    // closed. On main each id would produce a distinct "POST /api/entries/N"
    // key, so neither call would ever share a bucket.
    expect(mockConsume).toHaveBeenNthCalledWith(
      1,
      "POST /api/entries/:id:user:user-1",
      DYNAMIC_POST_POLICY,
    );
    expect(mockConsume).toHaveBeenNthCalledWith(
      2,
      "POST /api/entries/:id:user:user-1",
      DYNAMIC_POST_POLICY,
    );
  });

  it("meters the dynamic POST route even where a GET static sibling exists", () => {
    // POST /api/entries/on-this-day has no POST handler / policy of its own,
    // so it must still resolve to the POST :id policy — the GET static policy
    // on the same path must not un-meter it.
    rateLimitMiddleware(
      buildEvent("/api/entries/on-this-day", "POST", "user-1") as never,
    );

    expect(mockConsume).toHaveBeenCalledWith(
      "POST /api/entries/:id:user:user-1",
      DYNAMIC_POST_POLICY,
    );
  });

  it("meters the GET static sibling under its own policy", () => {
    rateLimitMiddleware(
      buildEvent("/api/entries/on-this-day", "GET", "user-1") as never,
    );

    expect(mockConsume).toHaveBeenCalledWith(
      "GET /api/entries/on-this-day:user:user-1",
      STATIC_GET_POLICY,
    );
  });

  it("still isolates the pattern bucket per user", () => {
    rateLimitMiddleware(
      buildEvent("/api/entries/1", "POST", "user-1") as never,
    );
    rateLimitMiddleware(
      buildEvent("/api/entries/9", "POST", "user-2") as never,
    );

    expect(mockConsume).toHaveBeenNthCalledWith(
      1,
      "POST /api/entries/:id:user:user-1",
      DYNAMIC_POST_POLICY,
    );
    expect(mockConsume).toHaveBeenNthCalledWith(
      2,
      "POST /api/entries/:id:user:user-2",
      DYNAMIC_POST_POLICY,
    );
  });

  it("does not meter the dynamic route under an unpolicied method", () => {
    rateLimitMiddleware(
      buildEvent("/api/entries/1", "DELETE", "user-1") as never,
    );

    expect(mockConsume).not.toHaveBeenCalled();
  });
});
