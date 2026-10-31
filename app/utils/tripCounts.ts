import type { TripStatus } from "~/utils/tripDates";

const NEUTRAL_SUMMARY = "Plan a route, log the journey, look back on it later.";

const COUNT_PHRASES: ReadonlyArray<[TripStatus, string]> = [
  ["ongoing", "ongoing"],
  ["upcoming", "on the calendar"],
  ["past", "in the books"],
];

// "1 ongoing, 2 on the calendar, 6 in the books." from real trip statuses;
// statuses with no trips are left out and no trips at all gives a neutral line.
export function summarizeTripCounts(
  trips: ReadonlyArray<{ status: TripStatus }>,
): string {
  const phrases = COUNT_PHRASES.map(([status, phrase]) => ({
    count: trips.filter((trip) => trip.status === status).length,
    phrase,
  }))
    .filter(({ count }) => count > 0)
    .map(({ count, phrase }) => `${count} ${phrase}`);

  if (phrases.length === 0) {
    return NEUTRAL_SUMMARY;
  }

  return `${phrases.join(", ")}.`;
}
