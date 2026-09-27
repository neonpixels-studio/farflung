/**
 * Tests for GET /api/trips — list, user-scoping, status filter, sort order,
 * and pagination.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockRequireUser,
  mockSelect,
  mockFrom,
  mockWhere,
  mockOrderBy,
  mockLimit,
  mockOffset,
  mockGetQuery,
  mockCreateError,
  mockEq,
  mockAsc,
  mockDesc,
} = vi.hoisted(() => {
  const mockOffset = vi.fn().mockResolvedValue([]);
  const mockLimit = vi.fn(() => ({ offset: mockOffset }));
  const mockOrderBy = vi.fn(() => ({ limit: mockLimit }));
  const mockWhere = vi.fn(() => ({ orderBy: mockOrderBy }));
  const mockFrom = vi.fn(() => ({ where: mockWhere }));
  const mockSelect = vi.fn(() => ({ from: mockFrom }));

  const mockRequireUser = vi.fn().mockReturnValue("user-1");
  const mockGetQuery = vi.fn().mockReturnValue({});
  const mockCreateError = vi.fn(
    (options: { statusCode: number; statusMessage: string }) =>
      Object.assign(new Error(options.statusMessage), options),
  );
  const mockEq = vi.fn((...args: unknown[]) => ({ type: "eq", args }));
  const mockAsc = vi.fn((column: unknown) => ({ type: "asc", column }));
  const mockDesc = vi.fn((column: unknown) => ({ type: "desc", column }));

  return {
    mockRequireUser,
    mockSelect,
    mockFrom,
    mockWhere,
    mockOrderBy,
    mockLimit,
    mockOffset,
    mockGetQuery,
    mockCreateError,
    mockEq,
    mockAsc,
    mockDesc,
  };
});

vi.mock("../../../server/utils/auth", () => ({
  requireUser: mockRequireUser,
}));

vi.mock("../../../server/db/index", () => ({
  getDb: () => ({ select: mockSelect }),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: mockEq,
    asc: mockAsc,
    desc: mockDesc,
    or: vi.fn(actual.or),
    lt: vi.fn(actual.lt),
    isNotNull: vi.fn(actual.isNotNull),
    not: vi.fn(actual.not),
  };
});

import { or, lt, isNotNull, not } from "drizzle-orm";
import { trips } from "../../../server/db/schema";
import { lapsedEndDateCutoff } from "../../../server/utils/tripStatus";

Object.assign(globalThis, {
  defineEventHandler: (handler: (event: object) => unknown) => handler,
  createError: mockCreateError,
  getQuery: mockGetQuery,
});

const { default: handler } =
  await import("../../../server/api/trips/index.get");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildEvent() {
  return { context: { userId: "user-1" } };
}

function setRows(rows: unknown[]) {
  mockOffset.mockResolvedValue(rows);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/trips", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockReturnValue("user-1");
    mockGetQuery.mockReturnValue({});
    mockOffset.mockResolvedValue([]);
  });

  it("returns the list of trips for the authenticated user", async () => {
    const sampleTrips = [
      { id: "t1", userId: "user-1", name: "Trip A", status: "ongoing" },
    ];
    setRows(sampleTrips);

    const result = await (handler as (event: object) => unknown)(buildEvent());

    expect(mockRequireUser).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ trips: sampleTrips, page: 1, hasMore: false });
  });

  it("scopes the query to the authenticated user's id", async () => {
    mockRequireUser.mockReturnValue("user-42");

    await (handler as (event: object) => unknown)({
      context: { userId: "user-42" },
    });

    // eq must have been called with the userId value somewhere in its args
    const eqCalls = mockEq.mock.calls;
    const hasUserIdFilter = eqCalls.some((args) => args.includes("user-42"));
    expect(hasUserIdFilter).toBe(true);
  });

  it("returns an empty trips array when the user has no trips", async () => {
    setRows([]);

    const result = (await (handler as (event: object) => unknown)(
      buildEvent(),
    )) as { trips: unknown[] };

    expect(result.trips).toEqual([]);
  });

  it("applies a status filter when the status query param is provided", async () => {
    mockGetQuery.mockReturnValue({ status: "ongoing" });

    await (handler as (event: object) => unknown)(buildEvent());

    expect(mockWhere).toHaveBeenCalledTimes(1);
    expect(mockOrderBy).toHaveBeenCalledTimes(1);
  });

  it("does not apply a status filter when status is 'All'", async () => {
    mockGetQuery.mockReturnValue({ status: "All" });

    await (handler as (event: object) => unknown)(buildEvent());

    expect(mockWhere).toHaveBeenCalledTimes(1);
  });

  it("throws 400 for an invalid status filter", async () => {
    mockGetQuery.mockReturnValue({ status: "invalid-status" });

    await expect(
      (handler as (event: object) => unknown)(buildEvent()),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("sorts ascending by createdAt with id as a tie-break when sort=asc is provided", async () => {
    mockGetQuery.mockReturnValue({ sort: "asc" });

    await (handler as (event: object) => unknown)(buildEvent());

    expect(mockOrderBy).toHaveBeenCalledTimes(1);
    expect(mockOrderBy.mock.calls[0]).toHaveLength(2);
    expect(mockAsc).toHaveBeenCalledWith(trips.createdAt);
    expect(mockAsc).toHaveBeenCalledWith(trips.id);
    expect(mockDesc).not.toHaveBeenCalled();
  });

  it("defaults to descending by createdAt with id as a tie-break when no sort param is provided", async () => {
    mockGetQuery.mockReturnValue({});

    await (handler as (event: object) => unknown)(buildEvent());

    expect(mockOrderBy).toHaveBeenCalledTimes(1);
    expect(mockOrderBy.mock.calls[0]).toHaveLength(2);
    expect(mockDesc).toHaveBeenCalledWith(trips.createdAt);
    expect(mockDesc).toHaveBeenCalledWith(trips.id);
    expect(mockAsc).not.toHaveBeenCalled();
  });

  it("throws 400 for an invalid sort value", async () => {
    mockGetQuery.mockReturnValue({ sort: "newest-first" });

    await expect(
      (handler as (event: object) => unknown)(buildEvent()),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 401 when not authenticated", async () => {
    mockRequireUser.mockImplementation(() => {
      throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
    });

    await expect(
      (handler as (event: object) => unknown)(buildEvent()),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  // -------------------------------------------------------------------------
  // Pagination
  // -------------------------------------------------------------------------

  it("defaults to page 1 and offset 0 when no page specified", async () => {
    const result = (await (handler as (event: object) => unknown)(
      buildEvent(),
    )) as { page: number };

    expect(result.page).toBe(1);
    expect(mockOffset).toHaveBeenCalledWith(0);
    expect(mockLimit).toHaveBeenCalledWith(20);
  });

  it("returns at most PAGE_SIZE trips with correct metadata on the first page", async () => {
    const fullPage = Array.from({ length: 20 }, (_, index) => ({
      id: `t-${index}`,
      userId: "user-1",
      name: `Trip ${index}`,
    }));
    setRows(fullPage);

    const result = (await (handler as (event: object) => unknown)(
      buildEvent(),
    )) as { trips: unknown[]; page: number; hasMore: boolean };

    expect(result.trips).toHaveLength(20);
    expect(result.page).toBe(1);
    expect(result.hasMore).toBe(true);
    // Pins the actual bound sent to the DB, not just the mock's own fixture
    // length — this is the guarantee the test name promises.
    expect(mockLimit).toHaveBeenCalledWith(20);
  });

  it("returns the correct slice on a later page", async () => {
    mockGetQuery.mockReturnValue({ page: "2" });
    const secondPageRows = [{ id: "t-20", userId: "user-1", name: "Trip 20" }];
    setRows(secondPageRows);

    const result = (await (handler as (event: object) => unknown)(
      buildEvent(),
    )) as { trips: unknown[]; page: number; hasMore: boolean };

    expect(result.trips).toEqual(secondPageRows);
    expect(result.page).toBe(2);
    expect(result.hasMore).toBe(false);
    expect(mockOffset).toHaveBeenCalledWith(20);
    expect(mockLimit).toHaveBeenCalledWith(20);
  });

  it("returns an empty list rather than erroring for an out-of-range page", async () => {
    mockGetQuery.mockReturnValue({ page: "999" });
    setRows([]);

    const result = (await (handler as (event: object) => unknown)(
      buildEvent(),
    )) as { trips: unknown[]; page: number; hasMore: boolean };

    expect(result.trips).toEqual([]);
    expect(result.page).toBe(999);
    expect(result.hasMore).toBe(false);
    expect(mockOffset).toHaveBeenCalledWith((999 - 1) * 20);
  });

  it("falls back to page 1 for a page beyond the MAX_PAGE bound", async () => {
    mockGetQuery.mockReturnValue({ page: "1001" });

    const result = (await (handler as (event: object) => unknown)(
      buildEvent(),
    )) as { page: number };

    expect(result.page).toBe(1);
    expect(mockOffset).toHaveBeenCalledWith(0);
  });

  it("honors the page exactly at the MAX_PAGE bound", async () => {
    mockGetQuery.mockReturnValue({ page: "1000" });

    const result = (await (handler as (event: object) => unknown)(
      buildEvent(),
    )) as { page: number };

    expect(result.page).toBe(1000);
    expect(mockOffset).toHaveBeenCalledWith((1000 - 1) * 20);
  });

  it("reports hasMore: false at MAX_PAGE even with a full page, since there is no page 1001 to serve", async () => {
    mockGetQuery.mockReturnValue({ page: "1000" });
    const fullPage = Array.from({ length: 20 }, (_, index) => ({
      id: `t-${index}`,
      userId: "user-1",
      name: `Trip ${index}`,
    }));
    setRows(fullPage);

    const result = (await (handler as (event: object) => unknown)(
      buildEvent(),
    )) as { hasMore: boolean };

    // A page-1001 request would clamp back to page 1 (see the "falls back"
    // test above), so advertising hasMore: true here would send a walker
    // into a request it can never resolve. Capping hasMore at the boundary
    // keeps the contract honest regardless of what any given client does
    // with it.
    expect(result.hasMore).toBe(false);
  });

  it("falls back to page 1 when the page param arrives as an array (repeated query key)", async () => {
    mockGetQuery.mockReturnValue({ page: ["1", "2"] });

    const result = (await (handler as (event: object) => unknown)(
      buildEvent(),
    )) as { page: number };

    expect(result.page).toBe(1);
    expect(mockOffset).toHaveBeenCalledWith(0);
  });

  it("falls back to page 1 for a non-safe-integer page param (e.g. 1e300)", async () => {
    mockGetQuery.mockReturnValue({ page: "1e300" });

    const result = (await (handler as (event: object) => unknown)(
      buildEvent(),
    )) as { page: number };

    expect(result.page).toBe(1);
    expect(mockOffset).toHaveBeenCalledWith(0);
  });

  it("falls back to page 1 for a non-numeric page param", async () => {
    mockGetQuery.mockReturnValue({ page: "not-a-number" });

    const result = (await (handler as (event: object) => unknown)(
      buildEvent(),
    )) as { page: number };

    expect(result.page).toBe(1);
    expect(mockOffset).toHaveBeenCalledWith(0);
  });

  it("falls back to page 1 for a negative page param", async () => {
    mockGetQuery.mockReturnValue({ page: "-3" });

    const result = (await (handler as (event: object) => unknown)(
      buildEvent(),
    )) as { page: number };

    expect(result.page).toBe(1);
    expect(mockOffset).toHaveBeenCalledWith(0);
  });

  it("falls back to page 1 for a zero page param", async () => {
    mockGetQuery.mockReturnValue({ page: "0" });

    const result = (await (handler as (event: object) => unknown)(
      buildEvent(),
    )) as { page: number };

    expect(result.page).toBe(1);
    expect(mockOffset).toHaveBeenCalledWith(0);
  });

  it("combines a status filter with a later page", async () => {
    mockGetQuery.mockReturnValue({ status: "past", page: "3" });
    const thirdPageRows = [{ id: "t-40", userId: "user-1", status: "past" }];
    setRows(thirdPageRows);

    const result = (await (handler as (event: object) => unknown)(
      buildEvent(),
    )) as { trips: unknown[]; page: number };

    expect(mockWhere).toHaveBeenCalledTimes(1);
    expect(result.trips).toEqual(thirdPageRows);
    expect(result.page).toBe(3);
    expect(mockOffset).toHaveBeenCalledWith(40);

    const eqCalls = mockEq.mock.calls;
    const hasStatusFilter = eqCalls.some((args) => args.includes("past"));
    expect(hasStatusFilter).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Derived status (issue #291): a lapsed endDate must win over the raw
  // stored column both in what's returned and in what a status filter matches.
  // ---------------------------------------------------------------------------

  describe("derived status", () => {
    const NOW = new Date("2026-06-15T00:00:00.000Z");

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("relabels a row's status to 'past' once its endDate has lapsed, even with no status filter applied", async () => {
      setRows([
        {
          id: "t-stale",
          userId: "user-1",
          name: "Stale Trip",
          status: "ongoing",
          endDate: new Date("2020-01-01T00:00:00.000Z"),
        },
      ]);

      const result = (await (handler as (event: object) => unknown)(
        buildEvent(),
      )) as { trips: { status: string }[] };

      expect(result.trips[0]?.status).toBe("past");
    });

    it("keeps a row's stored status when its endDate has not lapsed", async () => {
      setRows([
        {
          id: "t-live",
          userId: "user-1",
          name: "Live Trip",
          status: "upcoming",
          endDate: new Date("2999-01-01T00:00:00.000Z"),
        },
      ]);

      const result = (await (handler as (event: object) => unknown)(
        buildEvent(),
      )) as { trips: { status: string }[] };

      expect(result.trips[0]?.status).toBe("upcoming");
    });

    it("filters status=past to match both an explicit 'past' row and a lapsed 'ongoing'/'upcoming' row", async () => {
      mockGetQuery.mockReturnValue({ status: "past" });

      await (handler as (event: object) => unknown)(buildEvent());

      // The "past" branch matches eq(status, 'past') OR the lapsed condition.
      expect(mockEq).toHaveBeenCalledWith(trips.status, "past");
      expect(or).toHaveBeenCalled();
      expect(isNotNull).toHaveBeenCalledWith(trips.endDate);
      expect(lt).toHaveBeenCalledWith(trips.endDate, lapsedEndDateCutoff(NOW));
      expect(not).not.toHaveBeenCalled();
    });

    it("filters status=ongoing to match the stored status AND excludes a lapsed endDate", async () => {
      mockGetQuery.mockReturnValue({ status: "ongoing" });

      await (handler as (event: object) => unknown)(buildEvent());

      expect(mockEq).toHaveBeenCalledWith(trips.status, "ongoing");
      expect(isNotNull).toHaveBeenCalledWith(trips.endDate);
      expect(lt).toHaveBeenCalledWith(trips.endDate, lapsedEndDateCutoff(NOW));
      expect(not).toHaveBeenCalled();
    });
  });
});
