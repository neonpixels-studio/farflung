/**
 * Unit tests for netlify/functions/purge-deleted-accounts.mts — the thin
 * adapter that wires server/utils/purgeAccounts.ts to a real DB connection
 * and to Netlify's scheduled-function invocation.
 *
 * createDb and purgeExpiredDeletedAccounts are mocked so no network or
 * database access is needed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockCreateDb, mockPurgeExpiredDeletedAccounts } = vi.hoisted(() => ({
  mockCreateDb: vi.fn(() => ({ delete: vi.fn() })),
  mockPurgeExpiredDeletedAccounts: vi.fn(),
}));

vi.mock("../../.generated/scheduled-function-env", () => ({
  bakedEnvironment: {},
}));

vi.mock("../../server/db/index", () => ({
  createDb: mockCreateDb,
}));

vi.mock("../../server/utils/purgeAccounts", () => ({
  purgeExpiredDeletedAccounts: mockPurgeExpiredDeletedAccounts,
}));

const { handler } =
  await import("../../netlify/functions/purge-deleted-accounts.mts");

describe("purge-deleted-accounts scheduled function", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = "postgres://test/db";
  });

  afterEach(() => {
    process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it("builds a DB client from DATABASE_URL and returns 200 with the purge result", async () => {
    mockPurgeExpiredDeletedAccounts.mockResolvedValue({
      purgedUserIds: ["user-1", "user-2"],
      purgedCount: 2,
      failedBlobKeys: [],
    });

    const response = await handler();

    expect(mockCreateDb).toHaveBeenCalledWith("postgres://test/db");
    expect(mockPurgeExpiredDeletedAccounts).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      purgedUserIds: ["user-1", "user-2"],
      purgedCount: 2,
      failedBlobKeys: [],
    });
  });

  it("logs an error for orphaned blobs when some blob deletions failed, but still returns 200", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockPurgeExpiredDeletedAccounts.mockResolvedValue({
      purgedUserIds: ["user-1"],
      purgedCount: 1,
      failedBlobKeys: ["user-1/media-1", "user-1/media-1-thumb"],
    });

    const response = await handler();

    expect(response.statusCode).toBe(200);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("2 media blob(s) failed to delete"),
      ["user-1/media-1", "user-1/media-1-thumb"],
    );
    consoleSpy.mockRestore();
  });

  it("logs and re-throws when the purge run fails, so Netlify records the invocation as failed", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockPurgeExpiredDeletedAccounts.mockRejectedValue(
      new Error("DB unreachable"),
    );

    await expect(handler()).rejects.toThrow("DB unreachable");

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
