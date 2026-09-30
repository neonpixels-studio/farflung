/**
 * Tests for GET /api/billing/portal
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockEnsureUser,
  mockGetStripeCustomerIdForUser,
  mockCreateBillingPortalSession,
  mockSendRedirect,
} = vi.hoisted(() => ({
  mockEnsureUser: vi.fn().mockResolvedValue("user-1"),
  mockGetStripeCustomerIdForUser: vi.fn(),
  mockCreateBillingPortalSession: vi.fn(),
  mockSendRedirect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../server/utils/auth", () => ({
  ensureUser: mockEnsureUser,
}));

vi.mock("../../../server/utils/subscriptions", () => ({
  getStripeCustomerIdForUser: mockGetStripeCustomerIdForUser,
}));

vi.mock("../../../server/utils/stripe", () => ({
  createBillingPortalSession: mockCreateBillingPortalSession,
}));

Object.assign(globalThis, {
  defineEventHandler: (handler: (event: unknown) => unknown) => handler,
  createError: (options: { statusCode: number; statusMessage: string }) =>
    Object.assign(new Error(options.statusMessage), options),
  sendRedirect: mockSendRedirect,
});

const { default: handler } =
  await import("../../../server/api/billing/portal.get");

type Handler = (event: unknown) => Promise<unknown>;

function call(event: unknown = {}): Promise<unknown> {
  return (handler as Handler)(event);
}

describe("GET /api/billing/portal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureUser.mockResolvedValue("user-1");
    mockGetStripeCustomerIdForUser.mockResolvedValue("cus_123");
    mockCreateBillingPortalSession.mockResolvedValue({
      url: "https://billing.stripe.com/session_123",
    });
    process.env.NUXT_PUBLIC_SITE_ORIGIN = "https://farflung.io";
  });

  it("creates a portal session for the user's Stripe customer and redirects there", async () => {
    await call();

    expect(mockCreateBillingPortalSession).toHaveBeenCalledWith({
      customerId: "cus_123",
      returnUrl: "https://farflung.io/settings#billing",
    });
    expect(mockSendRedirect).toHaveBeenCalledWith(
      expect.anything(),
      "https://billing.stripe.com/session_123",
      302,
    );
  });

  it("throws 404 when the user has no Stripe customer on record", async () => {
    mockGetStripeCustomerIdForUser.mockResolvedValue(null);

    await expect(call()).rejects.toMatchObject({ statusCode: 404 });
    expect(mockCreateBillingPortalSession).not.toHaveBeenCalled();
  });

  it("throws 500 when NUXT_PUBLIC_SITE_ORIGIN is not configured", async () => {
    delete process.env.NUXT_PUBLIC_SITE_ORIGIN;

    await expect(call()).rejects.toMatchObject({ statusCode: 500 });
  });

  it("throws 502 when Stripe does not return a billing portal URL", async () => {
    mockCreateBillingPortalSession.mockResolvedValue({ url: null });

    await expect(call()).rejects.toMatchObject({ statusCode: 502 });
    expect(mockSendRedirect).not.toHaveBeenCalled();
  });

  it("propagates a 401 when the user is not authenticated", async () => {
    mockEnsureUser.mockRejectedValue(
      Object.assign(new Error("Unauthorized"), { statusCode: 401 }),
    );

    await expect(call()).rejects.toMatchObject({ statusCode: 401 });
    expect(mockCreateBillingPortalSession).not.toHaveBeenCalled();
  });
});
