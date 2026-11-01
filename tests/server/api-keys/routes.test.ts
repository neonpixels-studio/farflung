import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { stubNitroGlobals } from "../test-utils";

stubNitroGlobals();

const {
  mockEnsureUser,
  mockRequireUser,
  mockGetDb,
  insertChain,
  selectChain,
  updateChain,
} = vi.hoisted(() => {
  const insertChain = {
    values: vi.fn(() => insertChain),
    returning: vi.fn(),
  };
  const selectChain = {
    from: vi.fn(() => selectChain),
    where: vi.fn(),
    orderBy: vi.fn(),
  };
  const updateChain = {
    set: vi.fn(() => updateChain),
    where: vi.fn(() => updateChain),
    returning: vi.fn(),
  };
  return {
    mockEnsureUser: vi.fn(),
    mockRequireUser: vi.fn(),
    insertChain,
    selectChain,
    updateChain,
    mockGetDb: vi.fn(() => ({
      insert: vi.fn(() => insertChain),
      select: vi.fn((columns: unknown) => {
        selectedColumns.push(columns);
        return selectChain;
      }),
      update: vi.fn(() => updateChain),
    })),
  };
});

const selectedColumns: unknown[] = [];

vi.mock("../../../server/db/index", () => ({ getDb: mockGetDb }));
vi.mock("../../../server/utils/auth", () => ({
  ensureUser: mockEnsureUser,
  requireUser: mockRequireUser,
}));

const mockReadBody = vi.fn();
const mockSetResponseStatus = vi.fn();
const mockGetRouterParam = vi.fn();
vi.stubGlobal("readBody", mockReadBody);
vi.stubGlobal("setResponseStatus", mockSetResponseStatus);
vi.stubGlobal("getRouterParam", mockGetRouterParam);

const { default: postHandler } =
  await import("../../../server/api/api-keys/index.post");
const { default: getHandler } =
  await import("../../../server/api/api-keys/index.get");
const { default: deleteHandler } =
  await import("../../../server/api/api-keys/[id].delete");

const EVENT = { context: { userId: "user-1" } };

function call(handler: unknown): Promise<Record<string, unknown>> {
  return (handler as (event: object) => Promise<Record<string, unknown>>)(
    EVENT,
  );
}

function stubActiveKeyCount(total: number): void {
  selectChain.where.mockResolvedValue([{ total }]);
}

describe("POST /api/api-keys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureUser.mockResolvedValue("user-1");
    stubActiveKeyCount(0);
    insertChain.returning.mockImplementation(async () => {
      const values = insertChain.values.mock.calls.at(-1)?.[0 as never] as {
        id: string;
        name: string;
        prefix: string;
        expiresAt: Date | null;
      };
      return [
        {
          id: values.id,
          name: values.name,
          prefix: values.prefix,
          createdAt: new Date(),
          expiresAt: values.expiresAt,
        },
      ];
    });
  });

  it("returns the raw key once with 201 and stores only its hash", async () => {
    mockReadBody.mockResolvedValue({ name: "  Backfill  " });

    const result = await call(postHandler);

    expect(mockSetResponseStatus).toHaveBeenCalledWith(EVENT, 201);
    expect(Object.keys(result).sort()).toEqual(
      ["createdAt", "expiresAt", "id", "key", "name", "prefix"].sort(),
    );
    const key = result.key as string;
    expect(key).toMatch(/^ff_/);
    expect(result.name).toBe("Backfill");
    expect(result.prefix).toBe(key.slice(3, 11));
    expect(result.expiresAt).toBeNull();

    const stored = insertChain.values.mock.calls[0]?.[0 as never] as Record<
      string,
      unknown
    >;
    expect(stored.keyHash).toBe(createHash("sha256").update(key).digest("hex"));
    expect(Object.values(stored)).not.toContain(key);
    expect(stored.userId).toBe("user-1");
  });

  it("sets expiresAt from expiresInDays", async () => {
    mockReadBody.mockResolvedValue({ name: "Short lived", expiresInDays: 7 });
    const before = Date.now();

    const result = await call(postHandler);

    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const expiresAt = (result.expiresAt as Date).getTime();
    expect(expiresAt).toBeGreaterThanOrEqual(before + SEVEN_DAYS_MS);
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + SEVEN_DAYS_MS);
  });

  it.each([
    ["a missing name", {}],
    ["a blank name", { name: "   " }],
    ["a non-string name", { name: 7 }],
    ["an oversized name", { name: "x".repeat(101) }],
    ["zero days", { name: "a", expiresInDays: 0 }],
    ["fractional days", { name: "a", expiresInDays: 1.5 }],
    ["string days", { name: "a", expiresInDays: "7" }],
    ["too many days", { name: "a", expiresInDays: 3651 }],
  ])("rejects %s with 400", async (_label, body) => {
    mockReadBody.mockResolvedValue(body);

    await expect(call(postHandler)).rejects.toMatchObject({ statusCode: 400 });
    expect(insertChain.values).not.toHaveBeenCalled();
  });

  it("allows a fifth key but refuses a sixth", async () => {
    mockReadBody.mockResolvedValue({ name: "Another" });

    stubActiveKeyCount(4);
    await expect(call(postHandler)).resolves.toMatchObject({ name: "Another" });

    vi.clearAllMocks();
    stubActiveKeyCount(5);
    await expect(call(postHandler)).rejects.toMatchObject({ statusCode: 400 });
    expect(insertChain.values).not.toHaveBeenCalled();
  });

  it("counts only this user's active keys toward the cap", async () => {
    mockReadBody.mockResolvedValue({ name: "Another" });

    await call(postHandler);

    const whereSql = new PgDialect().sqlToQuery(
      selectChain.where.mock.calls[0]?.[0 as never] as unknown as SQL,
    ).sql;
    expect(whereSql).toContain('"api_keys"."user_id" = $');
    expect(whereSql).toContain('"api_keys"."revoked_at" is null');
    expect(whereSql).toContain('"api_keys"."expires_at" > $');
  });
});

describe("GET /api/api-keys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectedColumns.length = 0;
    mockRequireUser.mockReturnValue("user-1");
    selectChain.where.mockReturnValue(selectChain);
    selectChain.orderBy.mockResolvedValue([]);
  });

  it("never selects the hash or a raw key", async () => {
    await call(getHandler);

    const columns = Object.keys(selectedColumns[0] as object);
    expect(columns.sort()).toEqual(
      ["createdAt", "expiresAt", "id", "lastUsedAt", "name", "prefix"].sort(),
    );
  });

  it("scopes the list to the caller and hides revoked keys", async () => {
    await call(getHandler);

    const whereSql = new PgDialect().sqlToQuery(
      selectChain.where.mock.calls[0]?.[0 as never] as unknown as SQL,
    ).sql;
    expect(whereSql).toContain('"api_keys"."user_id" = $');
    expect(whereSql).toContain('"api_keys"."revoked_at" is null');
  });
});

describe("DELETE /api/api-keys/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockReturnValue("user-1");
    mockGetRouterParam.mockReturnValue("key-1");
  });

  it("stamps revokedAt on the caller's own key", async () => {
    updateChain.returning.mockResolvedValue([{ id: "key-1" }]);

    await expect(call(deleteHandler)).resolves.toEqual({ ok: true });

    expect(updateChain.set).toHaveBeenCalledWith({
      revokedAt: expect.any(Date),
    });
    const { sql: whereSql, params } = new PgDialect().sqlToQuery(
      updateChain.where.mock.calls[0]?.[0 as never] as unknown as SQL,
    );
    expect(whereSql).toContain('"api_keys"."user_id" = $');
    expect(params).toEqual(expect.arrayContaining(["key-1", "user-1"]));
  });

  it("returns 404 when no row matched, as for another user's key", async () => {
    updateChain.returning.mockResolvedValue([]);

    await expect(call(deleteHandler)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
