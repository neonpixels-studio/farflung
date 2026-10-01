import { describe, it, expect } from "vitest";
import { RATE_LIMIT_POLICIES } from "../../server/utils/rateLimitPolicies";
import { RateLimitStore } from "../../server/utils/rateLimitStore";

describe("POST /csp-report rate limit policy", () => {
  it("is policied, so the unauthenticated endpoint cannot be flooded", () => {
    expect(RATE_LIMIT_POLICIES["POST /csp-report"]).toBeDefined();
  });

  it("rejects requests from one IP past the limit but not another IP", () => {
    const policy = RATE_LIMIT_POLICIES["POST /csp-report"];
    const store = new RateLimitStore();
    const key = "POST /csp-report:ip:203.0.113.1";
    for (let attempt = 0; attempt < policy.limit; attempt++) {
      expect(store.consume(key, policy).allowed).toBe(true);
    }
    expect(store.consume(key, policy).allowed).toBe(false);
    expect(
      store.consume("POST /csp-report:ip:203.0.113.2", policy).allowed,
    ).toBe(true);
  });
});
