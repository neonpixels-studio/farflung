import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { stubNitroGlobals } from "../test-utils";

stubNitroGlobals();

const { mockGetDb, selectChain, updateChain } = vi.hoisted(() => {
  const selectChain = {
    from: vi.fn(() => selectChain),
    innerJoin: vi.fn(() => selectChain),
    where: vi.fn(() => selectChain),
    limit: vi.fn(),
  };
  const updateChain = {
    set: vi.fn(() => updateChain),
    where: vi.fn(),
  };
  return {
    selectChain,
    updateChain,
    mockGetDb: vi.fn(() => ({
      select: vi.fn(() => selectChain),
      update: vi.fn(() => updateChain),
    })),
  };
});

vi.mock("../../../server/db/index", () => ({ getDb: mockGetDb }));

const {
  findActiveApiKey,
  generateApiKey,
  hashApiKey,
  isApiKeyToken,
  recordApiKeyUse,
} = await import("../../../server/utils/apiKeys");

function renderSql(condition: unknown): string {
  return new PgDialect().sqlToQuery(condition as SQL).sql;
}

const NOW = new Date("2026-01-01T12:00:00.000Z");
const SECONDS_AGO = (seconds: number) =>
  new Date(NOW.getTime() - seconds * 1000);

describe("generateApiKey", () => {
  it("builds ff_ + 32 random base64url bytes, with a matching prefix and hash", () => {
    const { key, prefix, keyHash } = generateApiKey();

    expect(key).toMatch(/^ff_[A-Za-z0-9_-]{43}$/);
    expect(prefix).toBe(key.slice(3, 11));
    expect(keyHash).toBe(createHash("sha256").update(key).digest("hex"));
  });

  it("never repeats a key", () => {
    expect(generateApiKey().key).not.toBe(generateApiKey().key);
  });
});

describe("isApiKeyToken", () => {
  it("recognizes only the ff_ marker", () => {
    expect(isApiKeyToken("ff_abc")).toBe(true);
    expect(isApiKeyToken("eyJhbGciOi")).toBe(false);
    expect(isApiKeyToken("xff_abc")).toBe(false);
  });
});

describe("findActiveApiKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectChain.limit.mockResolvedValue([]);
  });

  it("returns null for an unknown key", async () => {
    await expect(findActiveApiKey("ff_unknown")).resolves.toBeNull();
  });

  it("returns the matching row", async () => {
    const row = { id: "key-1", userId: "user-1", lastUsedAt: null };
    selectChain.limit.mockResolvedValue([row]);

    await expect(findActiveApiKey("ff_known")).resolves.toEqual(row);
  });

  it("filters out revoked and expired keys and soft-deleted accounts", async () => {
    await findActiveApiKey("ff_known");

    const whereSql = renderSql(
      (selectChain.where.mock.calls as unknown[][])[0]?.[0],
    );
    expect(whereSql).toContain('"api_keys"."key_hash" = $1');
    expect(whereSql).toContain('"api_keys"."revoked_at" is null');
    expect(whereSql).toContain('"api_keys"."expires_at" is null');
    expect(whereSql).toContain('"api_keys"."expires_at" > $');
    expect(whereSql).toContain('"users"."deleted_at" is null');
  });

  it("looks the key up by hash, never by its raw value", async () => {
    await findActiveApiKey("ff_known");

    const { params } = new PgDialect().sqlToQuery(
      (selectChain.where.mock.calls as unknown[][])[0]?.[0] as unknown as SQL,
    );
    expect(params).toContain(hashApiKey("ff_known"));
    expect(params).not.toContain("ff_known");
  });
});

describe("recordApiKeyUse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateChain.where.mockResolvedValue(undefined);
  });

  function keyLastUsed(lastUsedAt: Date | null) {
    return { id: "key-1", userId: "user-1", lastUsedAt };
  }

  it("writes on a key's first use", async () => {
    await recordApiKeyUse(keyLastUsed(null), NOW);

    expect(updateChain.set).toHaveBeenCalledWith({ lastUsedAt: NOW });
  });

  it("skips the write within a minute of the last one", async () => {
    await recordApiKeyUse(keyLastUsed(SECONDS_AGO(59)), NOW);
    await recordApiKeyUse(keyLastUsed(SECONDS_AGO(60)), NOW);

    expect(mockGetDb).not.toHaveBeenCalled();
    expect(updateChain.set).not.toHaveBeenCalled();
  });

  it("writes once the minute has passed, guarding against concurrent writers", async () => {
    await recordApiKeyUse(keyLastUsed(SECONDS_AGO(61)), NOW);

    expect(updateChain.set).toHaveBeenCalledWith({ lastUsedAt: NOW });
    const whereSql = renderSql(updateChain.where.mock.calls[0]?.[0]);
    expect(whereSql).toContain('"api_keys"."last_used_at" is null');
    expect(whereSql).toContain('"api_keys"."last_used_at" < $');
  });

  it("logs a failed write without failing the request", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    updateChain.where.mockRejectedValue(new Error("db down"));

    await expect(
      recordApiKeyUse(keyLastUsed(null), NOW),
    ).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
