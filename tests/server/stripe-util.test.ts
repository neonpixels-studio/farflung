/**
 * Unit tests for server/utils/stripe.ts — the isolation boundary between
 * this app and the Stripe SDK.
 *
 * The `stripe` package itself is mocked so no network access is needed.
 * Each test that touches getStripeClient() re-imports the module fresh (via
 * vi.resetModules()) since the client is cached at module scope — without
 * that, tests would depend on execution order (whichever test runs first
 * decides what STRIPE_SECRET_KEY was in effect for the whole file).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCheckoutSessionsCreate = vi.fn();
const mockPortalSessionsCreate = vi.fn();
const mockConstructEvent = vi.fn();

// A plain `function` (not an arrow) so it can be invoked with `new` — the
// Stripe SDK is instantiated as `new Stripe(secretKey)` in server/utils/stripe.ts.
const MockStripe = vi.fn().mockImplementation(function MockStripeClient() {
  return {
    checkout: { sessions: { create: mockCheckoutSessionsCreate } },
    billingPortal: { sessions: { create: mockPortalSessionsCreate } },
    webhooks: { constructEvent: mockConstructEvent },
  };
});

vi.mock("stripe", () => ({ default: MockStripe }));

async function importFreshStripeUtil() {
  vi.resetModules();
  return import("../../server/utils/stripe");
}

const ENV_VARS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_PRICE_WANDERER_MONTHLY",
  "STRIPE_PRICE_WANDERER_YEARLY",
  "STRIPE_PRICE_NOMAD_MONTHLY",
  "STRIPE_PRICE_NOMAD_YEARLY",
  "STRIPE_WEBHOOK_SECRET",
];

beforeEach(() => {
  vi.clearAllMocks();
  for (const name of ENV_VARS) {
    delete process.env[name];
  }
});

// ---------------------------------------------------------------------------
// getPriceId / mapPriceIdToPlan — pure, env-var-driven, no SDK involved.
// ---------------------------------------------------------------------------

describe("getPriceId", () => {
  it("returns the configured Price ID for a tier + cycle", async () => {
    process.env.STRIPE_PRICE_WANDERER_MONTHLY = "price_wanderer_monthly";
    const { getPriceId } = await importFreshStripeUtil();

    expect(getPriceId("wanderer", "monthly")).toBe("price_wanderer_monthly");
  });

  it("returns null when unconfigured", async () => {
    const { getPriceId } = await importFreshStripeUtil();
    expect(getPriceId("nomad", "yearly")).toBeNull();
  });
});

describe("mapPriceIdToPlan", () => {
  it("maps a configured Price ID back to its tier + cycle", async () => {
    process.env.STRIPE_PRICE_NOMAD_YEARLY = "price_nomad_yearly";
    const { mapPriceIdToPlan } = await importFreshStripeUtil();

    expect(mapPriceIdToPlan("price_nomad_yearly")).toEqual({
      plan: "nomad",
      cycle: "yearly",
    });
  });

  it("correctly disambiguates when all four tier/cycle Price IDs are configured", async () => {
    process.env.STRIPE_PRICE_WANDERER_MONTHLY = "price_wanderer_monthly";
    process.env.STRIPE_PRICE_WANDERER_YEARLY = "price_wanderer_yearly";
    process.env.STRIPE_PRICE_NOMAD_MONTHLY = "price_nomad_monthly";
    process.env.STRIPE_PRICE_NOMAD_YEARLY = "price_nomad_yearly";
    const { mapPriceIdToPlan } = await importFreshStripeUtil();

    expect(mapPriceIdToPlan("price_wanderer_monthly")).toEqual({
      plan: "wanderer",
      cycle: "monthly",
    });
    expect(mapPriceIdToPlan("price_nomad_monthly")).toEqual({
      plan: "nomad",
      cycle: "monthly",
    });
  });

  it("returns null for an unrecognized Price ID", async () => {
    process.env.STRIPE_PRICE_WANDERER_MONTHLY = "price_wanderer_monthly";
    const { mapPriceIdToPlan } = await importFreshStripeUtil();

    expect(mapPriceIdToPlan("price_some_other_thing")).toBeNull();
  });

  it("returns null for null/undefined", async () => {
    const { mapPriceIdToPlan } = await importFreshStripeUtil();
    expect(mapPriceIdToPlan(null)).toBeNull();
    expect(mapPriceIdToPlan(undefined)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getStripeClient
// ---------------------------------------------------------------------------

describe("getStripeClient", () => {
  it("throws when STRIPE_SECRET_KEY is not set", async () => {
    const { getStripeClient } = await importFreshStripeUtil();
    expect(() => getStripeClient()).toThrow("STRIPE_SECRET_KEY is not set");
  });

  it("constructs a Stripe client once and caches it across calls", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    const { getStripeClient } = await importFreshStripeUtil();

    const first = getStripeClient();
    const second = getStripeClient();

    expect(MockStripe).toHaveBeenCalledTimes(1);
    expect(MockStripe).toHaveBeenCalledWith("sk_test_123");
    expect(first).toBe(second);
  });
});

// ---------------------------------------------------------------------------
// createCheckoutSession
// ---------------------------------------------------------------------------

describe("createCheckoutSession", () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
  });

  it("creates a subscription-mode session with the userId in subscription metadata", async () => {
    mockCheckoutSessionsCreate.mockResolvedValue({
      url: "https://checkout.stripe.com/session_123",
    });
    const { createCheckoutSession } = await importFreshStripeUtil();

    const session = await createCheckoutSession({
      userId: "user-1",
      priceId: "price_wanderer_monthly",
      existingCustomerId: null,
      successUrl: "https://app.test/settings",
      cancelUrl: "https://app.test/pricing",
    });

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith({
      mode: "subscription",
      line_items: [{ price: "price_wanderer_monthly", quantity: 1 }],
      client_reference_id: "user-1",
      customer: undefined,
      success_url: "https://app.test/settings",
      cancel_url: "https://app.test/pricing",
      subscription_data: {
        metadata: { userId: "user-1" },
        trial_period_days: 14,
      },
    });
    expect(session.url).toBe("https://checkout.stripe.com/session_123");
  });

  it("does not give a returning customer another trial", async () => {
    mockCheckoutSessionsCreate.mockResolvedValue({ url: "https://x" });
    const { createCheckoutSession } = await importFreshStripeUtil();

    await createCheckoutSession({
      userId: "user-1",
      priceId: "price_wanderer_monthly",
      existingCustomerId: "cus_existing",
      successUrl: "https://app.test/settings",
      cancelUrl: "https://app.test/pricing",
    });

    const [[sessionParams]] = mockCheckoutSessionsCreate.mock.calls;
    expect(sessionParams.subscription_data.trial_period_days).toBeUndefined();
  });

  it("reuses an existing Stripe customer ID when provided", async () => {
    mockCheckoutSessionsCreate.mockResolvedValue({ url: "https://x" });
    const { createCheckoutSession } = await importFreshStripeUtil();

    await createCheckoutSession({
      userId: "user-1",
      priceId: "price_wanderer_monthly",
      existingCustomerId: "cus_existing",
      successUrl: "https://app.test/settings",
      cancelUrl: "https://app.test/pricing",
    });

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_existing" }),
    );
  });
});

// ---------------------------------------------------------------------------
// createBillingPortalSession
// ---------------------------------------------------------------------------

describe("createBillingPortalSession", () => {
  it("creates a portal session for the given customer and return URL", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    mockPortalSessionsCreate.mockResolvedValue({
      url: "https://billing.stripe.com/session_123",
    });
    const { createBillingPortalSession } = await importFreshStripeUtil();

    const session = await createBillingPortalSession({
      customerId: "cus_1",
      returnUrl: "https://app.test/settings",
    });

    expect(mockPortalSessionsCreate).toHaveBeenCalledWith({
      customer: "cus_1",
      return_url: "https://app.test/settings",
    });
    expect(session.url).toBe("https://billing.stripe.com/session_123");
  });
});

// ---------------------------------------------------------------------------
// requireStripeWebhookSecret / constructStripeEvent
// ---------------------------------------------------------------------------

describe("requireStripeWebhookSecret", () => {
  it("throws when STRIPE_WEBHOOK_SECRET is not set", async () => {
    const { requireStripeWebhookSecret } = await importFreshStripeUtil();
    expect(() => requireStripeWebhookSecret()).toThrow(
      "STRIPE_WEBHOOK_SECRET is not set",
    );
  });

  it("returns the configured secret", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    const { requireStripeWebhookSecret } = await importFreshStripeUtil();
    expect(requireStripeWebhookSecret()).toBe("whsec_test");
  });
});

describe("constructStripeEvent", () => {
  it("verifies the signature via the Stripe client and returns the parsed event", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    const fakeEvent = { id: "evt_1", type: "customer.subscription.created" };
    mockConstructEvent.mockReturnValue(fakeEvent);
    const { constructStripeEvent } = await importFreshStripeUtil();

    const result = constructStripeEvent(
      '{"id":"evt_1"}',
      "t=1,v1=abc",
      "whsec_test",
    );

    expect(mockConstructEvent).toHaveBeenCalledWith(
      '{"id":"evt_1"}',
      "t=1,v1=abc",
      "whsec_test",
    );
    expect(result).toEqual(fakeEvent);
  });

  it("propagates a signature-verification failure", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    mockConstructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature");
    });
    const { constructStripeEvent } = await importFreshStripeUtil();

    expect(() =>
      constructStripeEvent("{}", "bad-signature", "whsec_test"),
    ).toThrow("No signatures found matching the expected signature");
  });
});
