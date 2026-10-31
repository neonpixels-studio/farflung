import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSendRedirect, mockGetQuery } = vi.hoisted(() => ({
  mockSendRedirect: vi.fn(),
  mockGetQuery: vi.fn(),
}));

Object.assign(globalThis, {
  defineEventHandler: (handler: (event: unknown) => unknown) => handler,
  getQuery: mockGetQuery,
  sendRedirect: mockSendRedirect,
});

const { default: handler } = await import("../../server/routes/sign-up.get");

function redirectTarget(query: Record<string, unknown>): URL {
  mockGetQuery.mockReturnValue(query);
  (handler as (event: unknown) => unknown)({});
  return new URL(mockSendRedirect.mock.calls[0]?.[1] as string);
}

describe("GET /sign-up", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to the sign-up page", () => {
    expect(redirectTarget({}).pathname).toBe("/sign-up");
  });

  it("renames email to the parameter Clerk prefills from", () => {
    const target = redirectTarget({ email: "dan+test@example.com" });
    expect(target.searchParams.get("email_address")).toBe(
      "dan+test@example.com",
    );
    expect(target.searchParams.has("email")).toBe(false);
  });

  it("omits the email parameter when none is given", () => {
    expect(redirectTarget({}).search).toBe("");
  });

  it("ignores a repeated email parameter", () => {
    expect(redirectTarget({ email: ["a@b.co", "c@d.co"] }).search).toBe("");
  });
});
