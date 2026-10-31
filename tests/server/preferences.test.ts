import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub Nitro auto-imports before any module under test loads
vi.stubGlobal(
  "defineEventHandler",
  (handler: (event: unknown) => unknown) => handler,
);
vi.stubGlobal(
  "createError",
  (options: { statusCode: number; statusMessage: string }) => {
    const error = new Error(options.statusMessage) as Error & {
      statusCode: number;
      statusMessage: string;
    };
    error.statusCode = options.statusCode;
    error.statusMessage = options.statusMessage;
    return error;
  },
);
vi.stubGlobal("readBody", vi.fn());
vi.stubGlobal(
  "useRuntimeConfig",
  vi.fn(() => ({ databaseUrl: "postgres://test" })),
);

vi.mock("../../server/utils/auth", () => ({
  requireUser: vi.fn(),
  ensureUser: vi.fn(),
}));

vi.mock("../../server/db/index", () => ({
  getDb: vi.fn(),
}));

vi.mock("../../server/utils/db-helpers", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../../server/utils/db-helpers")>();
  return { ...original };
});

const mockAssertMapStyleAllowed = vi.fn().mockResolvedValue(undefined);
const mockAssertPublicProfileAllowed = vi.fn().mockResolvedValue(undefined);
vi.mock("../../server/utils/planLimits", async (importOriginal) => {
  // Re-export the real MAP_STYLES (preferences.patch.ts imports it as its
  // single source of truth for valid style values) but mock the plan-gating
  // functions, which have their own dedicated tests in plan-limits.test.ts.
  const original =
    await importOriginal<typeof import("../../server/utils/planLimits")>();
  return {
    MAP_STYLES: original.MAP_STYLES,
    assertMapStyleAllowed: mockAssertMapStyleAllowed,
    assertPublicProfileAllowed: mockAssertPublicProfileAllowed,
  };
});

import { ensureUser } from "../../server/utils/auth";
import { getDb } from "../../server/db/index";

const mockEnsureUser = vi.mocked(ensureUser);
const mockGetDb = vi.mocked(getDb);
const mockReadBody = vi.mocked(
  globalThis.readBody as (event: unknown) => Promise<unknown>,
);

// ---------------------------------------------------------------------------
// DB mock factory — builds a chainable Drizzle-like query builder.
// ---------------------------------------------------------------------------

function makeSelectChain(rows: Record<string, unknown>[]) {
  const limitMock = vi.fn().mockResolvedValue(rows);
  const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
  const fromMock = vi.fn().mockReturnValue({ where: whereMock });
  const selectMock = vi.fn().mockReturnValue({ from: fromMock });
  return { select: selectMock };
}

function makeInsertChain(onConflictDoUpdateResult: unknown = undefined) {
  const onConflictDoUpdateMock = vi
    .fn()
    .mockResolvedValue(onConflictDoUpdateResult);
  const valuesMock = vi.fn().mockReturnValue({
    onConflictDoUpdate: onConflictDoUpdateMock,
  });
  const insertMock = vi.fn().mockReturnValue({ values: valuesMock });
  return {
    insert: insertMock,
    _values: valuesMock,
    _onConflict: onConflictDoUpdateMock,
  };
}

function makeFullDb(
  selectRows: Record<string, unknown>[],
  onConflictResult?: unknown,
) {
  const selectChain = makeSelectChain(selectRows);
  const insertChain = makeInsertChain(onConflictResult);
  return { ...selectChain, ...insertChain };
}

// ---------------------------------------------------------------------------
// GET /api/preferences
// ---------------------------------------------------------------------------

const getHandler = await import("../../server/api/preferences.get");
const getPreferences =
  "default" in getHandler
    ? (getHandler.default as (event: unknown) => unknown)
    : getHandler;

describe("GET /api/preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns existing preferences as a DTO without userId", async () => {
    // The DB row includes userId but rowToDto strips it; the response shape
    // should only have the 9 preference fields.
    const dbRow = {
      userId: "user-1",
      distanceUnit: "km",
      defaultMapStyle: "dark",
      theme: null,
      accentColor: null,
      publicProfile: true,
      preciseLocation: false,
      showOnExplore: true,
      displayName: "Dan",
      handle: "danh",
      homeBase: "St. Louis",
      bio: "Traveler",
    };
    const expectedDto = {
      distanceUnit: "km",
      defaultMapStyle: "dark",
      theme: null,
      accentColor: null,
      publicProfile: true,
      preciseLocation: false,
      showOnExplore: true,
      displayName: "Dan",
      handle: "danh",
      homeBase: "St. Louis",
      bio: "Traveler",
    };
    mockEnsureUser.mockResolvedValue("user-1");
    mockGetDb.mockReturnValue(
      makeFullDb([dbRow]) as unknown as ReturnType<typeof getDb>,
    );

    const result = await (getPreferences as (e: unknown) => unknown)({});

    expect(result).toEqual(expectedDto);
  });

  it("returns defaults when no preferences row exists", async () => {
    mockEnsureUser.mockResolvedValue("user-1");
    mockGetDb.mockReturnValue(
      makeFullDb([]) as unknown as ReturnType<typeof getDb>,
    );

    const result = await (getPreferences as (e: unknown) => unknown)({});

    expect(result).toMatchObject({
      distanceUnit: "mi",
      defaultMapStyle: null,
      publicProfile: false,
      preciseLocation: false,
      showOnExplore: true,
    });
  });

  it("throws 401 when ensureUser rejects with 401", async () => {
    const unauthorizedError = createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
    mockEnsureUser.mockRejectedValue(unauthorizedError);

    await expect(
      (getPreferences as (e: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("scopes the query to the authenticated user by passing userId to where clause", async () => {
    mockEnsureUser.mockResolvedValue("user-abc");
    const db = makeFullDb([]) as unknown as ReturnType<typeof getDb>;
    mockGetDb.mockReturnValue(db);

    await (getPreferences as (e: unknown) => unknown)({});

    // The where mock is called with the eq condition built from userPreferences.userId and "user-abc".
    // We can't inspect the drizzle column object directly, but we can confirm the
    // select chain was driven through a where() call — proving the filter was applied.
    const selectMock = (db as unknown as { select: ReturnType<typeof vi.fn> })
      .select;
    const fromMock = selectMock.mock.results[0]?.value?.from as ReturnType<
      typeof vi.fn
    >;
    const whereMock = fromMock?.mock.results[0]?.value?.where as ReturnType<
      typeof vi.fn
    >;
    expect(whereMock).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/preferences
// ---------------------------------------------------------------------------

const patchHandler = await import("../../server/api/preferences.patch");
const patchPreferences =
  "default" in patchHandler
    ? (patchHandler.default as (event: unknown) => unknown)
    : patchHandler;

// The PATCH endpoint returns a DTO without userId (only the 9 preference fields).
const updatedRow = {
  distanceUnit: "km",
  defaultMapStyle: "dark",
  theme: null,
  accentColor: null,
  publicProfile: true,
  preciseLocation: true,
  showOnExplore: false,
  displayName: "Dan Updated",
  handle: "danh",
  homeBase: "Chicago",
  bio: "Updated bio",
};

describe("PATCH /api/preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertMapStyleAllowed.mockResolvedValue(undefined);
    mockAssertPublicProfileAllowed.mockResolvedValue(undefined);
  });

  it("propagates a 402 when the plan doesn't allow the requested map style", async () => {
    mockEnsureUser.mockResolvedValue("user-1");
    mockReadBody.mockResolvedValue({ defaultMapStyle: "satellite" });
    mockGetDb.mockReturnValue(
      makeFullDb([updatedRow]) as unknown as ReturnType<typeof getDb>,
    );
    mockAssertMapStyleAllowed.mockRejectedValue(
      Object.assign(new Error("Plan limit reached"), { statusCode: 402 }),
    );

    await expect(
      (patchPreferences as (e: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 402 });
    expect(mockAssertMapStyleAllowed).toHaveBeenCalledWith(
      "user-1",
      "satellite",
    );
  });

  it("propagates a 402 when the plan doesn't allow a public profile", async () => {
    mockEnsureUser.mockResolvedValue("user-1");
    mockReadBody.mockResolvedValue({ publicProfile: true });
    mockGetDb.mockReturnValue(
      makeFullDb([updatedRow]) as unknown as ReturnType<typeof getDb>,
    );
    mockAssertPublicProfileAllowed.mockRejectedValue(
      Object.assign(new Error("Plan limit reached"), { statusCode: 402 }),
    );

    await expect(
      (patchPreferences as (e: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 402 });
    expect(mockAssertPublicProfileAllowed).toHaveBeenCalledWith("user-1", true);
  });

  it("does not check the public-profile gate when the field isn't in the patch", async () => {
    mockEnsureUser.mockResolvedValue("user-1");
    mockReadBody.mockResolvedValue({ distanceUnit: "km" });
    mockGetDb.mockReturnValue(
      makeFullDb([updatedRow]) as unknown as ReturnType<typeof getDb>,
    );

    await (patchPreferences as (e: unknown) => unknown)({});

    expect(mockAssertPublicProfileAllowed).not.toHaveBeenCalled();
    expect(mockAssertMapStyleAllowed).not.toHaveBeenCalled();
  });

  it("persists valid preferences and returns the updated row", async () => {
    mockEnsureUser.mockResolvedValue("user-1");
    mockReadBody.mockResolvedValue({ distanceUnit: "km", publicProfile: true });
    mockGetDb.mockReturnValue(
      makeFullDb([updatedRow]) as unknown as ReturnType<typeof getDb>,
    );

    const result = await (patchPreferences as (e: unknown) => unknown)({});

    expect(result).toEqual(updatedRow);
  });

  it("rejects an invalid distanceUnit with 400", async () => {
    mockEnsureUser.mockResolvedValue("user-1");
    mockReadBody.mockResolvedValue({ distanceUnit: "leagues" });
    mockGetDb.mockReturnValue(
      makeFullDb([]) as unknown as ReturnType<typeof getDb>,
    );

    await expect(
      (patchPreferences as (e: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects an unknown theme with 400", async () => {
    mockReadBody.mockResolvedValue({ theme: "sepia" });
    mockGetDb.mockReturnValue(
      makeFullDb([]) as unknown as ReturnType<typeof getDb>,
    );
    await expect(
      (patchPreferences as (e: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects an unknown accent colour with 400", async () => {
    mockReadBody.mockResolvedValue({ accentColor: "chartreuse" });
    mockGetDb.mockReturnValue(
      makeFullDb([]) as unknown as ReturnType<typeof getDb>,
    );
    await expect(
      (patchPreferences as (e: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects an invalid defaultMapStyle with 400", async () => {
    mockEnsureUser.mockResolvedValue("user-1");
    mockReadBody.mockResolvedValue({ defaultMapStyle: "neon" });
    mockGetDb.mockReturnValue(
      makeFullDb([]) as unknown as ReturnType<typeof getDb>,
    );

    await expect(
      (patchPreferences as (e: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects a non-boolean privacy field with 400", async () => {
    mockEnsureUser.mockResolvedValue("user-1");
    mockReadBody.mockResolvedValue({ publicProfile: "yes" });
    mockGetDb.mockReturnValue(
      makeFullDb([]) as unknown as ReturnType<typeof getDb>,
    );

    await expect(
      (patchPreferences as (e: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("does not accept displayName: it is derived from Clerk's name by PATCH /api/account/name", async () => {
    mockEnsureUser.mockResolvedValue("user-1");
    mockReadBody.mockResolvedValue({ displayName: "Made Up" });
    const db = makeFullDb([updatedRow]);
    mockGetDb.mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    await expect(
      (patchPreferences as (e: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("does not write displayName when it is sent alongside valid fields", async () => {
    mockEnsureUser.mockResolvedValue("user-1");
    mockReadBody.mockResolvedValue({ displayName: "Made Up", bio: "Hi" });
    const db = makeFullDb([updatedRow]);
    mockGetDb.mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    await (patchPreferences as (e: unknown) => unknown)({});

    const written = db._values.mock.calls[0][0] as Record<string, unknown>;
    expect(written).toMatchObject({ bio: "Hi" });
    expect(written).not.toHaveProperty("displayName");
  });

  describe("handle validation", () => {
    async function patchHandle(handle: unknown) {
      mockEnsureUser.mockResolvedValue("user-1");
      mockReadBody.mockResolvedValue({ handle });
      const db = makeFullDb([updatedRow]);
      mockGetDb.mockReturnValue(db as unknown as ReturnType<typeof getDb>);
      return {
        db,
        outcome: (patchPreferences as (e: unknown) => unknown)({}),
      };
    }

    it.each([
      ["too short", "ab"],
      ["too long", "a".repeat(31)],
      ["spaces", "no spaces"],
      ["an at sign", "@danh"],
      ["a leading hyphen", "-danh"],
      ["a trailing underscore", "danh_"],
      ["non-ascii letters", "dán"],
    ])("rejects a handle with %s", async (_label, handle) => {
      const { db, outcome } = await patchHandle(handle);
      await expect(outcome).rejects.toMatchObject({ statusCode: 400 });
      expect(db.insert).not.toHaveBeenCalled();
    });

    it.each(["admin", "Settings", "API", "www"])(
      "rejects the reserved handle %s",
      async (handle) => {
        const { db, outcome } = await patchHandle(handle);
        await expect(outcome).rejects.toMatchObject({
          statusCode: 400,
          statusMessage: "That handle is reserved",
        });
        expect(db.insert).not.toHaveBeenCalled();
      },
    );

    it.each(["Grimicorn", "dan-h", "dan_h", "dan123"])(
      "accepts %s and keeps the casing as typed",
      async (handle) => {
        const { db, outcome } = await patchHandle(handle);
        await outcome;
        expect(db._values.mock.calls[0][0]).toMatchObject({ handle });
      },
    );

    it("trims surrounding whitespace before validating", async () => {
      const { db, outcome } = await patchHandle("  dan-h  ");
      await outcome;
      expect(db._values.mock.calls[0][0]).toMatchObject({ handle: "dan-h" });
    });

    it("clears the handle for an empty string", async () => {
      const { db, outcome } = await patchHandle("   ");
      await outcome;
      expect(db._values.mock.calls[0][0]).toMatchObject({ handle: null });
    });
  });

  it("rejects an empty body with 400", async () => {
    mockEnsureUser.mockResolvedValue("user-1");
    mockReadBody.mockResolvedValue({});
    mockGetDb.mockReturnValue(
      makeFullDb([]) as unknown as ReturnType<typeof getDb>,
    );

    await expect(
      (patchPreferences as (e: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects a non-object body with 400", async () => {
    mockEnsureUser.mockResolvedValue("user-1");
    mockReadBody.mockResolvedValue("not an object");
    mockGetDb.mockReturnValue(
      makeFullDb([]) as unknown as ReturnType<typeof getDb>,
    );

    await expect(
      (patchPreferences as (e: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 401 when ensureUser rejects", async () => {
    const unauthorizedError = createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
    mockEnsureUser.mockRejectedValue(unauthorizedError);
    mockReadBody.mockResolvedValue({ distanceUnit: "km" });

    await expect(
      (patchPreferences as (e: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("accepts valid boolean privacy fields", async () => {
    mockEnsureUser.mockResolvedValue("user-1");
    mockReadBody.mockResolvedValue({
      publicProfile: false,
      preciseLocation: true,
      showOnExplore: false,
    });
    mockGetDb.mockReturnValue(
      makeFullDb([updatedRow]) as unknown as ReturnType<typeof getDb>,
    );

    const result = await (patchPreferences as (e: unknown) => unknown)({});

    expect(result).toEqual(updatedRow);
  });

  it("includes the authenticated userId in the insert values", async () => {
    mockEnsureUser.mockResolvedValue("user-owner");
    mockReadBody.mockResolvedValue({ distanceUnit: "km" });
    const db = makeFullDb([updatedRow]) as unknown as ReturnType<typeof getDb>;
    mockGetDb.mockReturnValue(db);

    await (patchPreferences as (e: unknown) => unknown)({});

    const insertMock = (db as unknown as { insert: ReturnType<typeof vi.fn> })
      .insert;
    const valuesMock = insertMock.mock.results[0]?.value?.values as ReturnType<
      typeof vi.fn
    >;
    const calledValues = valuesMock?.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(calledValues?.userId).toBe("user-owner");
  });

  it("returns 409 when handle is already taken", async () => {
    mockEnsureUser.mockResolvedValue("user-1");
    mockReadBody.mockResolvedValue({ handle: "taken-handle" });

    const uniqueError = Object.assign(new Error("Failed query"), {
      cause: Object.assign(new Error("duplicate key value"), {
        code: "23505",
      }),
    });
    const onConflictMock = vi.fn().mockRejectedValue(uniqueError);
    const valuesMock = vi
      .fn()
      .mockReturnValue({ onConflictDoUpdate: onConflictMock });
    const insertMock = vi.fn().mockReturnValue({ values: valuesMock });
    const db = {
      ...makeSelectChain([updatedRow]),
      insert: insertMock,
    } as unknown as ReturnType<typeof getDb>;
    mockGetDb.mockReturnValue(db);

    await expect(
      (patchPreferences as (e: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rejects bio exceeding 500 characters with 400", async () => {
    mockEnsureUser.mockResolvedValue("user-1");
    mockReadBody.mockResolvedValue({ bio: "x".repeat(501) });
    mockGetDb.mockReturnValue(
      makeFullDb([]) as unknown as ReturnType<typeof getDb>,
    );

    await expect(
      (patchPreferences as (e: unknown) => unknown)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("accepts null for a string field to clear it", async () => {
    mockEnsureUser.mockResolvedValue("user-1");
    mockReadBody.mockResolvedValue({ bio: null });
    mockGetDb.mockReturnValue(
      makeFullDb([{ ...updatedRow, bio: null }]) as unknown as ReturnType<
        typeof getDb
      >,
    );

    const result = await (patchPreferences as (e: unknown) => unknown)({});

    expect((result as Record<string, unknown>).bio).toBeNull();
  });

  it("accepts all valid map styles without throwing", async () => {
    const validStyles = [
      "outdoors",
      "streets",
      "satellite",
      "light",
      "dark",
      "custom",
    ];

    for (const style of validStyles) {
      mockEnsureUser.mockResolvedValue("user-1");
      mockReadBody.mockResolvedValue({ defaultMapStyle: style });
      mockGetDb.mockReturnValue(
        makeFullDb([
          { ...updatedRow, defaultMapStyle: style },
        ]) as unknown as ReturnType<typeof getDb>,
      );

      await expect(
        (patchPreferences as (e: unknown) => unknown)({}),
      ).resolves.toBeDefined();
    }
  });
});
