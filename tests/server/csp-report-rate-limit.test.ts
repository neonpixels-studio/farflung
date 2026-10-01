import { describe, it, expect, vi } from "vitest";
import { stubNitroGlobals } from "./test-utils";

stubNitroGlobals();

Object.assign(globalThis, {
  setResponseHeader: vi.fn(),
  getRequestIP: (event: { ip: string }) => event.ip,
  getHeader: vi.fn(),
});

const { default: rateLimitMiddleware } =
  await import("../../server/middleware/rateLimit");
const { RATE_LIMIT_POLICIES } =
  await import("../../server/utils/rateLimitPolicies");

const CSP_POLICY = RATE_LIMIT_POLICIES["POST /csp-report"];
const run = rateLimitMiddleware as (event: unknown) => void;

function cspEvent(ip: string) {
  return { path: "/csp-report", method: "POST", context: {}, ip };
}

describe("POST /csp-report rate limiting through the real middleware", () => {
  it("returns 429 per IP once the policy limit is exceeded", () => {
    for (let attempt = 0; attempt < CSP_POLICY.limit; attempt++) {
      expect(() => run(cspEvent("203.0.113.1"))).not.toThrow();
    }
    expect(() => run(cspEvent("203.0.113.1"))).toThrow(
      expect.objectContaining({ statusCode: 429 }),
    );
    expect(() => run(cspEvent("203.0.113.2"))).not.toThrow();
  });
});
