import { describe, it, expect, vi, beforeEach } from "vitest";
import type { H3Event } from "h3";
import { stubNitroGlobals } from "../test-utils";

stubNitroGlobals();

const { mockFindActiveApiKey, mockRecordApiKeyUse } = vi.hoisted(() => ({
  mockFindActiveApiKey: vi.fn(),
  mockRecordApiKeyUse: vi.fn(),
}));

vi.stubGlobal("getHeader", (event: FakeEvent, name: string) => {
  return event.headers[name.toLowerCase()];
});
vi.stubGlobal("setResponseHeader", vi.fn());
vi.stubGlobal("getRequestIP", () => "203.0.113.9");

vi.mock("../../../server/utils/clerk", () => ({
  requireClerkSecretKey: vi.fn(() => "sk-test"),
  verifyClerkToken: vi.fn(),
}));

vi.mock("../../../server/utils/apiKeys", async () => {
  const actual = await vi.importActual<
    typeof import("../../../server/utils/apiKeys")
  >("../../../server/utils/apiKeys");
  return {
    isApiKeyToken: actual.isApiKeyToken,
    findActiveApiKey: mockFindActiveApiKey,
    recordApiKeyUse: mockRecordApiKeyUse,
  };
});

import { verifyClerkToken } from "../../../server/utils/clerk";

const mockVerifyClerkToken = vi.mocked(verifyClerkToken);

const { default: authMiddleware } =
  await import("../../../server/middleware/auth");
const { default: rateLimitMiddleware } =
  await import("../../../server/middleware/rateLimit");

type FakeEvent = {
  path: string;
  method: string;
  headers: Record<string, string>;
  context: { userId?: string; authMethod?: string };
};

const VALID_KEY = "ff_valid-key";
const KEY_USER_ID = "user-with-key";
const ACTIVE_KEY_ROW = { id: "key-1", userId: KEY_USER_ID, lastUsedAt: null };

function makeEvent(overrides: Partial<FakeEvent> = {}): FakeEvent {
  return {
    path: "/api/places",
    method: "POST",
    headers: { authorization: `Bearer ${VALID_KEY}` },
    context: {},
    ...overrides,
  };
}

function runAuth(event: FakeEvent) {
  return (authMiddleware as (event: unknown) => Promise<void>)(
    event as unknown as H3Event,
  );
}

function runRateLimit(event: FakeEvent) {
  return (rateLimitMiddleware as (event: unknown) => void)(
    event as unknown as H3Event,
  );
}

describe("auth middleware with API keys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindActiveApiKey.mockResolvedValue(ACTIVE_KEY_ROW);
    mockRecordApiKeyUse.mockResolvedValue(undefined);
  });

  it("authenticates a valid key and records its use", async () => {
    const event = makeEvent();

    await runAuth(event);

    expect(event.context.userId).toBe(KEY_USER_ID);
    expect(event.context.authMethod).toBe("api_key");
    expect(mockFindActiveApiKey).toHaveBeenCalledWith(VALID_KEY);
    expect(mockRecordApiKeyUse).toHaveBeenCalledWith(ACTIVE_KEY_ROW);
    expect(mockVerifyClerkToken).not.toHaveBeenCalled();
  });

  it("returns the same 401 as a bad Clerk token for an inactive key", async () => {
    mockFindActiveApiKey.mockResolvedValue(null);
    mockVerifyClerkToken.mockRejectedValue(new Error("bad token"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const keyEvent = makeEvent();
    const clerkEvent = makeEvent({ headers: { authorization: "Bearer bad" } });

    const keyError = await runAuth(keyEvent).catch((error) => error);
    const clerkError = await runAuth(clerkEvent).catch((error) => error);

    expect(keyError.statusCode).toBe(401);
    expect(keyError.statusMessage).toBe(clerkError.statusMessage);
    expect(keyEvent.context.userId).toBeUndefined();
    expect(mockRecordApiKeyUse).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("surfaces a database failure instead of reporting it as a bad key", async () => {
    const databaseError = new Error("connection refused");
    mockFindActiveApiKey.mockRejectedValue(databaseError);

    await expect(runAuth(makeEvent())).rejects.toBe(databaseError);
  });

  it("leaves Clerk tokens to Clerk verification", async () => {
    mockVerifyClerkToken.mockResolvedValue("clerk-user");
    const event = makeEvent({ headers: { authorization: "Bearer clerk-jwt" } });

    await runAuth(event);

    expect(event.context.userId).toBe("clerk-user");
    expect(event.context.authMethod).toBe("clerk");
    expect(mockFindActiveApiKey).not.toHaveBeenCalled();
  });

  it("identifies the owner on an optional-auth GET", async () => {
    const event = makeEvent({ path: "/api/trips/trip-1", method: "GET" });

    await runAuth(event);

    expect(event.context.userId).toBe(KEY_USER_ID);
    expect(event.context.authMethod).toBe("api_key");
  });

  it("rejects an inactive key on an optional-auth GET rather than going anonymous", async () => {
    mockFindActiveApiKey.mockResolvedValue(null);
    const event = makeEvent({ path: "/api/trips/trip-1", method: "GET" });

    await expect(runAuth(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  it.each([
    ["GET", "/api/api-keys"],
    ["POST", "/api/api-keys"],
    ["POST", "/api/api-keys/"],
    ["DELETE", "/api/api-keys/key-2"],
    ["PATCH", "/api/account/name"],
    ["DELETE", "/api/account"],
    ["GET", "/api/billing/portal"],
    ["GET", "/api/billing/subscription?x=1"],
    ["GET", "/api/connections/google"],
    ["POST", "/api/connections/instagram/import"],
    ["GET", "/api/connections/instagram/callback"],
    ["POST", "/api/webhooks/stripe"],
    ["POST", "/api//account/name"],
  ])("denies a key on %s %s with 403", async (method, path) => {
    const event = makeEvent({ method, path });

    await expect(runAuth(event)).rejects.toMatchObject({ statusCode: 403 });
  });

  it.each([
    ["POST", "/api/places"],
    ["POST", "/api/media"],
    ["POST", "/api/entries"],
    ["PATCH", "/api/trips/trip-1"],
    ["GET", "/api/accounting-export"],
  ])("allows a key on %s %s", async (method, path) => {
    const event = makeEvent({ method, path });

    await expect(runAuth(event)).resolves.toBeUndefined();
    expect(event.context.userId).toBe(KEY_USER_ID);
  });

  it("keeps the deny-listed routes open to a Clerk session", async () => {
    mockVerifyClerkToken.mockResolvedValue("clerk-user");
    const event = makeEvent({
      path: "/api/api-keys",
      headers: { authorization: "Bearer clerk-jwt" },
    });

    await runAuth(event);

    expect(event.context.userId).toBe("clerk-user");
  });

  it("leaves token-less webhook requests to their own signature check", async () => {
    const event = makeEvent({ path: "/api/webhooks/stripe", headers: {} });

    await runAuth(event);

    expect(event.context.userId).toBeUndefined();
    expect(mockFindActiveApiKey).not.toHaveBeenCalled();
  });

  it("makes key requests share the owner's rate limit bucket with Clerk requests", async () => {
    const MEDIA_UPLOAD_LIMIT = 20;
    mockVerifyClerkToken.mockResolvedValue(KEY_USER_ID);

    for (let request = 0; request < MEDIA_UPLOAD_LIMIT; request += 1) {
      const event = makeEvent({ path: "/api/media" });
      await runAuth(event);
      runRateLimit(event);
    }

    const clerkEvent = makeEvent({
      path: "/api/media",
      headers: { authorization: "Bearer clerk-jwt" },
    });
    await runAuth(clerkEvent);
    expect(() => runRateLimit(clerkEvent)).toThrowError(
      expect.objectContaining({ statusCode: 429 }),
    );
  });
});
