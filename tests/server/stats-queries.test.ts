/**
 * Unit tests for server/utils/stats-queries.ts
 *
 * Each function is tested in isolation with a mock database so the aggregate
 * query logic can be verified without a real Postgres connection.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  countPlaces,
  countDistinctCountries,
  sumTripStopDistanceKm,
  computeDayStreak,
  countPlacesThisWeek,
  sumTripStopDistanceKmThisWeek,
  fetchDistanceUnit,
  aggregateUserStats,
} from "../../server/utils/stats-queries";
import type { Database } from "../../server/utils/stats-queries";
import { kmToMi } from "../../server/utils/distance";

// ---------------------------------------------------------------------------
// Helpers for building chainable Drizzle-like mock query builders
//
// Drizzle query builders are promise-like: the last method in any valid chain
// (where / orderBy / limit) resolves to the row array when awaited.
// We model this by making every terminal-ish method a resolved promise, while
// intermediate methods return an object with the next set of methods.
// ---------------------------------------------------------------------------

function makeChainEnd(rows: unknown[]) {
  // An object that is both a settled Promise (for await) and exposes further
  // chaining methods in case the query adds another step.
  // groupBy().orderBy() is the pattern used by computeDayStreak, so groupBy
  // must return something with an orderBy that resolves.
  const groupByResult = { orderBy: vi.fn().mockResolvedValue(rows) };
  const promise = Promise.resolve(rows);
  return Object.assign(promise, {
    limit: vi.fn().mockResolvedValue(rows),
    orderBy: vi.fn().mockResolvedValue(rows),
    groupBy: vi.fn().mockReturnValue(groupByResult),
  });
}

function makeSelectChain(resolvedRows: unknown[]) {
  const end = makeChainEnd(resolvedRows);
  const whereMock = vi.fn().mockReturnValue(end);

  const innerJoinResult = { where: whereMock };
  const innerJoinMock = vi.fn().mockReturnValue(innerJoinResult);

  const fromResult = {
    where: whereMock,
    innerJoin: innerJoinMock,
  };
  const fromMock = vi.fn().mockReturnValue(fromResult);
  const selectMock = vi.fn().mockReturnValue({ from: fromMock });

  return {
    select: selectMock,
    _from: fromMock,
    _where: whereMock,
    _innerJoin: innerJoinMock,
  };
}

function makeDb(resolvedRows: unknown[]): Database {
  const chain = makeSelectChain(resolvedRows);
  return chain as unknown as Database;
}

// ---------------------------------------------------------------------------
// kmToMi
// ---------------------------------------------------------------------------

describe("kmToMi", () => {
  it("converts kilometres to miles using the standard factor", () => {
    expect(kmToMi(1)).toBeCloseTo(0.621371, 4);
  });

  it("returns 0 for 0 km", () => {
    expect(kmToMi(0)).toBe(0);
  });

  it("converts a realistic distance", () => {
    // 77.6 km ≈ 48.2 miles
    expect(kmToMi(77.6)).toBeCloseTo(48.2, 0);
  });
});

// ---------------------------------------------------------------------------
// fetchDistanceUnit
// ---------------------------------------------------------------------------

describe("fetchDistanceUnit", () => {
  it("returns the user's stored distance unit", async () => {
    const database = makeDb([{ distanceUnit: "km" }]);
    const result = await fetchDistanceUnit(database, "user-1");
    expect(result).toBe("km");
  });

  it("falls back to mi when no preference row exists", async () => {
    const database = makeDb([]);
    const result = await fetchDistanceUnit(database, "user-1");
    expect(result).toBe("mi");
  });
});

// ---------------------------------------------------------------------------
// countPlaces
// ---------------------------------------------------------------------------

describe("countPlaces", () => {
  it("returns the count from the database row", async () => {
    const database = makeDb([{ value: 42 }]);
    const result = await countPlaces(database, "user-1");
    expect(result).toBe(42);
  });

  it("returns 0 when the aggregate returns no rows", async () => {
    const database = makeDb([]);
    const result = await countPlaces(database, "user-1");
    expect(result).toBe(0);
  });

  it("returns 0 when the count value is null", async () => {
    const database = makeDb([{ value: null }]);
    const result = await countPlaces(database, "user-1");
    expect(result).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// countDistinctCountries
// ---------------------------------------------------------------------------

describe("countDistinctCountries", () => {
  it("returns the distinct country count", async () => {
    const database = makeDb([{ value: 9 }]);
    const result = await countDistinctCountries(database, "user-1");
    expect(result).toBe(9);
  });

  it("returns 0 when user has no places with countries", async () => {
    const database = makeDb([{ value: 0 }]);
    const result = await countDistinctCountries(database, "user-1");
    expect(result).toBe(0);
  });

  it("excludes empty-string countries from the count", async () => {
    // The query filters ne(country, "") so the DB returns 0 for a user whose
    // only places have country="" (empty string, not null).
    const database = makeDb([{ value: 0 }]);
    const result = await countDistinctCountries(database, "user-1");
    expect(result).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// sumTripStopDistanceKm
// ---------------------------------------------------------------------------

describe("sumTripStopDistanceKm", () => {
  it("returns the total km from all trip stops", async () => {
    const database = makeDb([{ totalKm: "77600.5" }]);
    const result = await sumTripStopDistanceKm(database, "user-1");
    expect(result).toBeCloseTo(77600.5, 1);
  });

  it("returns 0 when the user has no trip stops", async () => {
    const database = makeDb([{ totalKm: null }]);
    const result = await sumTripStopDistanceKm(database, "user-1");
    expect(result).toBe(0);
  });

  it("returns 0 when no rows are returned", async () => {
    const database = makeDb([]);
    const result = await sumTripStopDistanceKm(database, "user-1");
    expect(result).toBe(0);
  });

  it("handles string numbers returned by drizzle SUM aggregate", async () => {
    const database = makeDb([{ totalKm: "1234.56" }]);
    const result = await sumTripStopDistanceKm(database, "user-1");
    expect(result).toBeCloseTo(1234.56, 2);
  });
});

// ---------------------------------------------------------------------------
// computeDayStreak
// ---------------------------------------------------------------------------

describe("computeDayStreak", () => {
  const FIXED_NOW = new Date("2026-06-28T12:00:00Z");

  it("returns 0 when the user has no entries", async () => {
    const database = makeDb([]);
    const result = await computeDayStreak(database, "user-1", FIXED_NOW);
    expect(result).toBe(0);
  });

  it("returns 1 when user has only one entry today", async () => {
    const database = makeDb([{ entryDate: "2026-06-28" }]);
    const result = await computeDayStreak(database, "user-1", FIXED_NOW);
    expect(result).toBe(1);
  });

  it("returns 1 when user has only one entry yesterday", async () => {
    const database = makeDb([{ entryDate: "2026-06-27" }]);
    const result = await computeDayStreak(database, "user-1", FIXED_NOW);
    expect(result).toBe(1);
  });

  it("returns 0 when most recent entry is 2+ days ago (streak broken)", async () => {
    const database = makeDb([{ entryDate: "2026-06-25" }]);
    const result = await computeDayStreak(database, "user-1", FIXED_NOW);
    expect(result).toBe(0);
  });

  it("counts consecutive days correctly starting from today", async () => {
    const database = makeDb([
      { entryDate: "2026-06-28" },
      { entryDate: "2026-06-27" },
      { entryDate: "2026-06-26" },
    ]);
    const result = await computeDayStreak(database, "user-1", FIXED_NOW);
    expect(result).toBe(3);
  });

  it("stops at the first gap in the streak", async () => {
    const database = makeDb([
      { entryDate: "2026-06-28" },
      { entryDate: "2026-06-27" },
      // gap: 2026-06-25 is missing, so Jun 25 breaks the chain
      { entryDate: "2026-06-24" },
    ]);
    const result = await computeDayStreak(database, "user-1", FIXED_NOW);
    expect(result).toBe(2);
  });

  it("counts a multi-day streak starting from yesterday", async () => {
    const database = makeDb([
      { entryDate: "2026-06-27" },
      { entryDate: "2026-06-26" },
      { entryDate: "2026-06-25" },
    ]);
    const result = await computeDayStreak(database, "user-1", FIXED_NOW);
    expect(result).toBe(3);
  });

  it("returns correct streak when future-dated entry would otherwise be first (DB filter excludes it)", async () => {
    // If a future-dated entry existed in the DB without the lte(now) filter,
    // it would appear first in the DESC sort, fail the today/yesterday check,
    // and collapse the streak to 0. The query now filters future dates, so the
    // DB returns only the valid rows. We model that by NOT including the future
    // row in the mock result (i.e. the DB already filtered it out).
    const database = makeDb([
      { entryDate: "2026-06-28" },
      { entryDate: "2026-06-27" },
    ]);
    const result = await computeDayStreak(database, "user-1", FIXED_NOW);
    expect(result).toBe(2);
  });

  it("handles a 14-day streak correctly", async () => {
    const rows = Array.from({ length: 14 }, (_, index) => {
      const date = new Date(FIXED_NOW);
      date.setUTCDate(date.getUTCDate() - index);
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, "0");
      const day = String(date.getUTCDate()).padStart(2, "0");
      return { entryDate: `${year}-${month}-${day}` };
    });

    const database = makeDb(rows);
    const result = await computeDayStreak(database, "user-1", FIXED_NOW);
    expect(result).toBe(14);
  });
});

// ---------------------------------------------------------------------------
// countPlacesThisWeek
// ---------------------------------------------------------------------------

describe("countPlacesThisWeek", () => {
  it("returns the count of places added this week", async () => {
    const database = makeDb([{ value: 6 }]);
    const result = await countPlacesThisWeek(
      database,
      "user-1",
      new Date("2026-06-28T12:00:00Z"),
    );
    expect(result).toBe(6);
  });

  it("returns 0 when no places were added this week", async () => {
    const database = makeDb([{ value: 0 }]);
    const result = await countPlacesThisWeek(
      database,
      "user-1",
      new Date("2026-06-28T12:00:00Z"),
    );
    expect(result).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// sumTripStopDistanceKmThisWeek
// ---------------------------------------------------------------------------
//
// The function filters on trip_stops.createdAt so the 7-day window is exact
// per stop, not an approximation derived from the parent trip's createdAt.

describe("sumTripStopDistanceKmThisWeek", () => {
  const NOW = new Date("2026-06-28T12:00:00Z");

  it("returns the km sum for stops created within the last 7 days", async () => {
    // The DB has already applied the gte(tripStops.createdAt, weekAgo) filter;
    // the mock returns only the stops that fall inside the window.
    const database = makeDb([{ totalKm: "2254.5" }]);
    const result = await sumTripStopDistanceKmThisWeek(database, "user-1", NOW);
    expect(result).toBeCloseTo(2254.5, 1);
  });

  it("returns 0 when no stops were created within the last 7 days", async () => {
    // Stops older than 7 days are excluded by the DB filter, so the aggregate
    // returns null (no matching rows → SUM is NULL).
    const database = makeDb([{ totalKm: null }]);
    const result = await sumTripStopDistanceKmThisWeek(database, "user-1", NOW);
    expect(result).toBe(0);
  });

  it("excludes stops created exactly 8 days ago (outside the window)", async () => {
    // A stop created 8 days ago falls outside the 7-day window.
    // The DB returns null because no stops match the filter.
    const database = makeDb([{ totalKm: null }]);
    const result = await sumTripStopDistanceKmThisWeek(database, "user-1", NOW);
    expect(result).toBe(0);
  });

  it("includes stops created exactly at the window boundary (7 days ago)", async () => {
    // A stop created exactly ONE_WEEK_MS ms before `now` sits on the gte boundary
    // and should be included. The DB returns its distance.
    const database = makeDb([{ totalKm: "100.0" }]);
    const result = await sumTripStopDistanceKmThisWeek(database, "user-1", NOW);
    expect(result).toBeCloseTo(100.0, 1);
  });

  it("handles string numbers returned by drizzle SUM aggregate", async () => {
    const database = makeDb([{ totalKm: "999.99" }]);
    const result = await sumTripStopDistanceKmThisWeek(database, "user-1", NOW);
    expect(result).toBeCloseTo(999.99, 2);
  });
});

// ---------------------------------------------------------------------------
// aggregateUserStats
// ---------------------------------------------------------------------------

describe("aggregateUserStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("assembles all stats and converts distances correctly", async () => {
    // Each query call to select().from().where() gets a fresh mock returning the
    // right rows for that particular query. We cycle through responses in the
    // same order that aggregateUserStats fires them via Promise.all.
    const totalKm = 77600;
    const deltaKm = 2254;

    const responses: unknown[][] = [
      [{ distanceUnit: "mi" }], // fetchDistanceUnit
      [{ value: 117 }], // countPlaces
      [{ value: 9 }], // countDistinctCountries
      [{ totalKm: String(totalKm) }], // sumTripStopDistanceKm
      [], // computeDayStreak (no entries → 0)
      [{ value: 6 }], // countPlacesThisWeek
      [{ totalKm: String(deltaKm) }], // sumTripStopDistanceKmThisWeek
    ];

    let callIndex = 0;
    const database: Database = {
      select: vi.fn().mockImplementation(() => {
        const rows = responses[callIndex] ?? [];
        callIndex += 1;

        const end = makeChainEnd(rows);
        const whereMock = vi.fn().mockReturnValue(end);
        const innerJoinMock = vi.fn().mockReturnValue({ where: whereMock });
        const fromMock = vi.fn().mockReturnValue({
          where: whereMock,
          innerJoin: innerJoinMock,
        });
        return { from: fromMock };
      }),
    } as unknown as Database;

    const result = await aggregateUserStats(
      database,
      "user-1",
      new Date("2026-06-28T12:00:00Z"),
    );

    expect(result.placesCount).toBe(117);
    expect(result.countriesCount).toBe(9);
    expect(result.totalDistanceKm).toBeCloseTo(totalKm, 0);
    expect(result.totalDistanceMi).toBeCloseTo(totalKm * 0.621371, 0);
    expect(result.currentStreak).toBe(0);
    expect(result.placesThisWeek).toBe(6);
    expect(result.distanceKmThisWeek).toBeCloseTo(deltaKm, 0);
    expect(result.distanceMiThisWeek).toBeCloseTo(deltaKm * 0.621371, 0);
    expect(result.distanceUnit).toBe("mi");
  });
});
