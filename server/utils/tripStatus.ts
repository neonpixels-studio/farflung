import { TRIP_STATUS } from "../db/schema";
import type { trips } from "../db/schema";

type TripStatusFields = {
  status: (typeof trips.$inferSelect)["status"];
  // `undefined` as well as `null`: defensively tolerated because not every
  // caller is a full DB row — e.g. a partially-built test fixture, or a
  // future caller assembling this shape by hand, may omit `endDate` rather
  // than setting it explicitly to `null`.
  endDate: (typeof trips.$inferSelect)["endDate"] | undefined;
};

/**
 * Whether a trip counts toward the plan's max-active-trips limit.
 *
 * `trips.status` is only ever set by explicit client input on create/patch
 * (see server/api/trips/index.post.ts and server/api/trips/[id].patch.ts) —
 * nothing in this codebase auto-transitions it as a trip's dates lapse. A
 * trip a user forgot to flip to "past" would otherwise count against their
 * plan's active-trip limit forever (see issue #278), so this derives the
 * *effective* status from `endDate` rather than trusting the stored value
 * alone: once the UTC calendar day after `endDate` has begun, the trip is
 * treated as over regardless of what `status` says.
 *
 * Comparing calendar days (rather than `endDate` plus a fixed 24h) matters
 * because `endDate` isn't guaranteed to be UTC midnight — `parseOptionalDate`
 * accepts any parseable date string, and the column is a full `timestamp`,
 * not a date-only type. A raw instant-vs-instant comparison, or a naive
 * "+24h", would cut a traveler's final day short (or long) depending on what
 * time of day the value happened to carry. Truncating both sides to a UTC
 * calendar day keeps the trip active through the entirety of its `endDate`
 * day no matter what time component it was stored with.
 *
 * An explicit "past" status always wins, even with no `endDate` to derive
 * from (e.g. a trip cancelled before it started) — derivation can only push
 * a trip toward "not active", it never pulls one back into counting.
 */
export function isTripCountedAsActive(
  trip: TripStatusFields,
  now: Date = new Date(),
): boolean {
  if (trip.status === TRIP_STATUS.PAST) {
    return false;
  }
  if (trip.endDate === null || trip.endDate === undefined) {
    return true;
  }
  const startOfDayAfterEndDate = Date.UTC(
    trip.endDate.getUTCFullYear(),
    trip.endDate.getUTCMonth(),
    trip.endDate.getUTCDate() + 1,
  );
  return startOfDayAfterEndDate > now.getTime();
}

/**
 * The effective status a read path should show for a trip: the stored value,
 * unless the trip has fallen out of `isTripCountedAsActive` (an elapsed
 * `endDate`, or an explicit "past"), in which case the derived status is
 * always "past" regardless of what's stored.
 *
 * This is the same normalization index.post.ts and [id].patch.ts already
 * apply at write time (see their `effectiveStatus`/`normalizeStaleStatus`
 * logic) — factored out here so every *read* path (list/filter queries,
 * single-trip lookups, search, explore, profile) can apply it too, instead of
 * only getting a correct status until the next write touches the row (issue
 * #291). Like `isTripCountedAsActive`, this only ever coerces a trip *toward*
 * "past" — it never promotes "upcoming" to "ongoing" from `startDate`; this
 * codebase has no such transition today.
 */
export function deriveTripStatus(
  trip: TripStatusFields,
  now: Date = new Date(),
): TripStatusFields["status"] {
  return isTripCountedAsActive(trip, now) ? trip.status : TRIP_STATUS.PAST;
}

/**
 * Returns `trip` with its `status` field overwritten by `deriveTripStatus`,
 * preserving every other field verbatim. Shared by every read path that
 * already has the full row shape in hand (a single-trip lookup, or a list
 * whose rows get relabeled after the fact) so "spread the row, replace
 * status" isn't repeated at each call site — see trip-queries.ts's
 * loadReadableTrip, profile-queries.ts's fetchPublicTrips, and
 * index.get.ts's row mapping.
 */
export function withDerivedStatus<T extends TripStatusFields>(
  trip: T,
  now: Date = new Date(),
): T {
  return { ...trip, status: deriveTripStatus(trip, now) };
}

/**
 * The instant at/after which a trip's `endDate` counts as lapsed for "now" —
 * i.e. the UTC start of today. A read path that filters at the SQL level
 * (comparing the `end_date` column directly with `lt`, rather than loading
 * rows into JS to call `isTripCountedAsActive`/`deriveTripStatus`) uses this
 * to build a condition equivalent to "endDate's UTC calendar day is in the
 * past" without re-deriving the calendar-day math independently.
 *
 * Equivalence with `isTripCountedAsActive`'s per-row check: that function
 * treats a trip as lapsed once `Date.UTC(endYear, endMonth, endDate + 1) <=
 * now`, i.e. once now's UTC calendar day is after endDate's. That is exactly
 * "endDate < UTC start of now's calendar day" — a single cutoff instant every
 * row's `endDate` can be compared against with a plain `<`, rather than a
 * per-row cutoff derived from that row's own `endDate`. See
 * server/api/trips/index.get.ts's status filter for the call site, and
 * tests/server/utils/tripStatus.test.ts for the boundary cases this must
 * agree with.
 */
export function lapsedEndDateCutoff(now: Date = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}
