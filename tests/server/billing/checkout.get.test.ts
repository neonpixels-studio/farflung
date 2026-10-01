/**
 * Tests for GET /api/billing/checkout
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockEnsureUser,
  mockGetStripeCustomerIdForUser,
  mockGetSubscriptionForUser,
  mockGetPriceId,
  mockCreateCheckoutSession,
  mockSendRedirect,
  mockGetQuery,
} = vi.hoisted(() => ({
  mockEnsureUser: vi.fn().mockResolvedValue("user-1"),
  mockGetStripeCustomerIdForUser: vi.fn().mockResolvedValue(null),
  mockGetSubscriptionForUser: vi.fn(),
  mockGetPriceId: vi.fn(),
  mockCreateCheckoutSession: vi.fn(),
  mockSendRedirect: vi.fn().mockResolvedValue(undefined),
  mockGetQuery: vi.fn().mockReturnValue({}),
}));

vi.mock("../../../server/utils/auth", () => ({
  ensureUser: mockEnsureUser,
}));

vi.mock("../../../server/utils/subscriptions", () => ({
  getStripeCustomerIdForUser: mockGetStripeCustomerIdForUser,
  getSubscriptionForUser: mockGetSubscriptionForUser,
}));

vi.mock("../../../server/utils/stripe", () => ({
  getPriceId: mockGetPriceId,
  createCheckoutSession: mockCreateCheckoutSession,
}));

Object.assign(globalThis, {
  defineEventHandler: (handler: (event: unknown) => unknown) => handler,
  createError: (options: { statusCode: number; statusMessage: string }) =>
    Object.assign(new Error(options.statusMessage), options),
  sendRedirect: mockSendRedirect,
  getQuery: mockGetQuery,
});

const { default: handler } =
  await import("../../../server/api/billing/checkout.get");

type Handler = (event: unknown) => Promise<unknown>;

function call(event: unknown = {}): Promise<unknown> {
  return (handler as Handler)(event);
}

describe("GET /api/billing/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureUser.mockResolvedValue("user-1");
    mockGetStripeCustomerIdForUser.mockResolvedValue(null);
    mockGetSubscriptionForUser.mockResolvedValue({
      plan: "drifter",
      status: "active",
    });
    mockGetQuery.mockReturnValue({ tier: "wanderer", cycle: "monthly" });
    mockGetPriceId.mockReturnValue("price_wanderer_monthly");
    mockCreateCheckoutSession.mockResolvedValue({
      url: "https://checkout.stripe.com/session_123",
    });
    process.env.NUXT_PUBLIC_SITE_ORIGIN = "https://farflung.io";
  });

  it("creates a checkout session and redirects to its URL", async () => {
    await call();

    expect(mockCreateCheckoutSession).toHaveBeenCalledWith({
      userId: "user-1",
      priceId: "price_wanderer_monthly",
      existingCustomerId: null,
      successUrl: "https://farflung.io/settings#billing",
      cancelUrl: "https://farflung.io/pricing",
    });
    expect(mockSendRedirect).toHaveBeenCalledWith(
      expect.anything(),
      "https://checkout.stripe.com/session_123",
      302,
    );
  });

  it("reuses an existing Stripe customer ID", async () => {
    mockGetStripeCustomerIdForUser.mockResolvedValue("cus_existing");

    await call();

    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ existingCustomerId: "cus_existing" }),
    );
  });

  it("honors a valid relative redirectTo for the success URL", async () => {
    mockGetQuery.mockReturnValue({
      tier: "nomad",
      cycle: "yearly",
      redirectTo: "/somewhere",
    });

    await call();

    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        successUrl: "https://farflung.io/somewhere",
      }),
    );
  });

  it("ignores a protocol-relative redirectTo (open-redirect guard)", async () => {
    mockGetQuery.mockReturnValue({
      tier: "wanderer",
      cycle: "monthly",
      redirectTo: "//evil.example.com",
    });

    await call();

    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        successUrl: "https://farflung.io/settings#billing",
      }),
    );
  });

  it("ignores an absolute-URL redirectTo (open-redirect guard)", async () => {
    mockGetQuery.mockReturnValue({
      tier: "wanderer",
      cycle: "monthly",
      redirectTo: "https://evil.example.com",
    });

    await call();

    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        successUrl: "https://farflung.io/settings#billing",
      }),
    );
  });

  it("throws 400 for an invalid tier", async () => {
    mockGetQuery.mockReturnValue({ tier: "enterprise", cycle: "monthly" });

    await expect(call()).rejects.toMatchObject({ statusCode: 400 });
    expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
  });

  it("throws 400 for an invalid cycle", async () => {
    mockGetQuery.mockReturnValue({ tier: "wanderer", cycle: "weekly" });

    await expect(call()).rejects.toMatchObject({ statusCode: 400 });
    expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
  });

  it("throws 400 when the tier/cycle has no configured Price ID", async () => {
    mockGetPriceId.mockReturnValue(null);

    await expect(call()).rejects.toMatchObject({ statusCode: 400 });
    expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
  });

  it("throws 409 when the user already has an active paid subscription (prevents double-charging)", async () => {
    mockGetSubscriptionForUser.mockResolvedValue({
      plan: "wanderer",
      status: "active",
    });

    await expect(call()).rejects.toMatchObject({ statusCode: 409 });
    expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
  });

  it("throws 409 when the user's paid subscription is past_due", async () => {
    mockGetSubscriptionForUser.mockResolvedValue({
      plan: "nomad",
      status: "past_due",
    });

    await expect(call()).rejects.toMatchObject({ statusCode: 409 });
    expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
  });

  it("allows checkout for a canceled former subscriber", async () => {
    mockGetSubscriptionForUser.mockResolvedValue({
      plan: "wanderer",
      status: "canceled",
    });

    await call();

    expect(mockCreateCheckoutSession).toHaveBeenCalled();
  });

  it("allows checkout for a free Drifter user", async () => {
    mockGetSubscriptionForUser.mockResolvedValue({
      plan: "drifter",
      status: "active",
    });

    await call();

    expect(mockCreateCheckoutSession).toHaveBeenCalled();
  });

  it("throws 500 when NUXT_PUBLIC_SITE_ORIGIN is not configured", async () => {
    delete process.env.NUXT_PUBLIC_SITE_ORIGIN;

    await expect(call()).rejects.toMatchObject({ statusCode: 500 });
  });

  it("throws 502 when Stripe does not return a checkout URL", async () => {
    mockCreateCheckoutSession.mockResolvedValue({ url: null });

    await expect(call()).rejects.toMatchObject({ statusCode: 502 });
  });

  it("propagates a 401 when the user is not authenticated", async () => {
    mockEnsureUser.mockRejectedValue(
      Object.assign(new Error("Unauthorized"), { statusCode: 401 }),
    );

    await expect(call()).rejects.toMatchObject({ statusCode: 401 });
    expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
  });
});
