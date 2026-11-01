/**
 * Aggregate query utilities for user stats.
 *
 * All functions accept a pre-built database instance and a userId so they can
 * be called from any server context and tested in isolation without mocking
 * module-level singletons.
 */
import {
  count,
  countDistinct,
  sum,
  eq,
  gte,
  and,
  ne,
  lte,
  sql,
} from "drizzle-orm";
import type { getDb } from "../db/index";
import { kmToMi } from "./distance";
import {
  places,
  trips,
  tripStops,
  entries,
  userPreferences,
  DISTANCE_UNIT,
} from "../db/schema";

export type Database = ReturnType<typeof getDb>;

export type DistanceUnit = (typeof DISTANCE_UNIT)[keyof typeof DISTANCE_UNIT];

// One calendar week expressed in milliseconds — used for period-over-period
// delta queries (places added this week, miles logged this week).
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Extracts the first integer count from a single-row aggregate result. */
function firstCount(rows: { value: number | null }[]): number {
  return rows[0]?.value ?? 0;
}

export interface UserStats {
  placesCount: number;
  countriesCount: number;
  totalDistanceMi: number;
  totalDistanceKm: number;
  currentStreak: number;
  placesThisWeek: number;
  distanceMiThisWeek: number;
  distanceKmThisWeek: number;
  distanceUnit: DistanceUnit;
}

/**
 * Fetches the user's preferred distance unit from `user_preferences`.
 * Falls back to miles when no preference row exists.
 */
export async function fetchDistanceUnit(
  database: Database,
  userId: string,
): Promise<DistanceUnit> {
  const rows = await database
    .select({ distanceUnit: userPreferences.distanceUnit })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  return rows[0]?.distanceUnit ?? DISTANCE_UNIT.MI;
}

/**
 * Returns the total number of places owned by `userId`.
 */
export async function countPlaces(
  database: Database,
  userId: string,
): Promise<number> {
  const rows = await database
    .select({ value: count() })
    .from(places)
    .where(eq(places.userId, userId));

  return firstCount(rows);
}

/**
 * Returns the number of distinct non-null, non-empty countries across the user's places.
 */
export async function countDistinctCountries(
  database: Database,
  userId: string,
): Promise<number> {
  // countDistinct excludes NULLs; the ne() predicate also excludes empty strings.
  const rows = await database
    .select({ value: countDistinct(places.country) })
    .from(places)
    .where(and(eq(places.userId, userId), ne(places.country, "")));

  return firstCount(rows);
}

/**
 * Returns the sum of `distance_km` across all trip stops belonging to the
 * user's trips. Stops with a null `distance_km` are excluded from the SQL
 * SUM aggregate (standard SQL behaviour). A null aggregate result — meaning
 * no stops have a non-null distance — is treated as zero by the caller.
 */
export async function sumTripStopDistanceKm(
  database: Database,
  userId: string,
): Promise<number> {
  const rows = await database
    .select({
      totalKm: sum(tripStops.distanceKm),
    })
    .from(tripStops)
    .innerJoin(trips, eq(tripStops.tripId, trips.id))
    .where(eq(trips.userId, userId));

  const raw = rows[0]?.totalKm;
  const parsed = parseFloat(String(raw ?? "0"));
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Computes the current consecutive-day streak of journal entries for a user.
 *
 * A streak is the number of distinct UTC calendar days (working backwards from
 * today) on which the user has at least one entry with a non-null `occurredAt`.
 *
 * Rules:
 * - Today counts: if the user has an entry today, the streak is at least 1.
 * - Yesterday counts toward the same streak: consecutive days are chained.
 * - A gap of more than one day breaks the streak; counting stops at the gap.
 * - A user with no entries has a streak of 0.
 */
export async function computeDayStreak(
  database: Database,
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  // Pull distinct UTC dates on which the user has entries, most recent first.
  // `occurredAt` is `timestamp` without time zone, so values are stored as UTC
  // wall-clock. Format directly (no AT TIME ZONE cast) so the bucketed date
  // matches the JS UTC anchors (toUtcDateString) regardless of the DB session tz.
  // Exclude future-dated entries (user-supplied occurredAt can be ahead of now)
  // so a future entry doesn't become the most-recent date and collapse the streak.
  const rows = await database
    .select({
      entryDate: sql<string>`TO_CHAR(${entries.occurredAt}, 'YYYY-MM-DD')`,
    })
    .from(entries)
    .where(
      and(
        eq(entries.userId, userId),
        sql`${entries.occurredAt} IS NOT NULL`,
        lte(entries.occurredAt, now),
      ),
    )
    .groupBy(sql`TO_CHAR(${entries.occurredAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`TO_CHAR(${entries.occurredAt}, 'YYYY-MM-DD') DESC`);

  if (rows.length === 0) {
    return 0;
  }

  const todayUtc = toUtcDateString(now);
  const yesterdayUtc = toUtcDateString(
    new Date(now.getTime() - 24 * 60 * 60 * 1000),
  );

  // The most recent entry date must be today or yesterday to start a streak.
  // An older most-recent date means the streak already broke.
  const mostRecentDate = rows[0]?.entryDate;
  if (mostRecentDate !== todayUtc && mostRecentDate !== yesterdayUtc) {
    return 0;
  }

  let streak = 0;
  let expectedDate = mostRecentDate;

  for (const row of rows) {
    if (row.entryDate !== expectedDate) {
      break;
    }

    streak += 1;
    expectedDate = previousUtcDateString(expectedDate);
  }

  return streak;
}

/**
 * Returns the number of places the user created in the last 7 days.
 */
export async function countPlacesThisWeek(
  database: Database,
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  const weekAgo = new Date(now.getTime() - ONE_WEEK_MS);

  const rows = await database
    .select({ value: count() })
    .from(places)
    .where(and(eq(places.userId, userId), gte(places.createdAt, weekAgo)));

  return firstCount(rows);
}

/**
 * Returns the sum of trip-stop distances (in km) for stops created in the
 * last 7 days, using each stop's own `createdAt` for an exact window.
 */
export async function sumTripStopDistanceKmThisWeek(
  database: Database,
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  const weekAgo = new Date(now.getTime() - ONE_WEEK_MS);

  const rows = await database
    .select({ totalKm: sum(tripStops.distanceKm) })
    .from(tripStops)
    .innerJoin(trips, eq(tripStops.tripId, trips.id))
    .where(and(eq(trips.userId, userId), gte(tripStops.createdAt, weekAgo)));

  const raw = rows[0]?.totalKm;
  const parsed = parseFloat(String(raw ?? "0"));
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Aggregates all stats for the given user into a single object.
 * The distance fields are returned in both km and mi so the caller (the HTTP
 * handler) can select the right unit based on the user's preference.
 */
export async function aggregateUserStats(
  database: Database,
  userId: string,
  now: Date = new Date(),
): Promise<UserStats> {
  const [
    distanceUnit,
    placesCount,
    countriesCount,
    totalKm,
    streak,
    placesThisWeek,
    deltaKm,
  ] = await Promise.all([
    fetchDistanceUnit(database, userId),
    countPlaces(database, userId),
    countDistinctCountries(database, userId),
    sumTripStopDistanceKm(database, userId),
    computeDayStreak(database, userId, now),
    countPlacesThisWeek(database, userId, now),
    sumTripStopDistanceKmThisWeek(database, userId, now),
  ]);

  return {
    placesCount,
    countriesCount,
    totalDistanceKm: totalKm,
    totalDistanceMi: kmToMi(totalKm),
    currentStreak: streak,
    placesThisWeek,
    distanceKmThisWeek: deltaKm,
    distanceMiThisWeek: kmToMi(deltaKm),
    distanceUnit,
  };
}

// ---------------------------------------------------------------------------
// Internal date helpers
// ---------------------------------------------------------------------------

function toUtcDateString(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function previousUtcDateString(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return toUtcDateString(date);
}
