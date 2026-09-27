import { describe, it, expect } from "vitest";
import {
  isTripCountedAsActive,
  deriveTripStatus,
  withDerivedStatus,
  lapsedEndDateCutoff,
} from "../../../server/utils/tripStatus";
import { TRIP_STATUS } from "../../../server/db/schema";

const NOW = new Date("2026-06-15T00:00:00.000Z");
const FUTURE_DATE = new Date("2026-07-01T00:00:00.000Z");
const PAST_DATE = new Date("2026-06-01T00:00:00.000Z");

describe("isTripCountedAsActive", () => {
  it("counts an upcoming trip whose endDate is still ahead of now", () => {
    expect(
      isTripCountedAsActive(
        { status: TRIP_STATUS.UPCOMING, endDate: FUTURE_DATE },
        NOW,
      ),
    ).toBe(true);
  });

  it("counts an ongoing trip with no endDate set yet", () => {
    expect(
      isTripCountedAsActive(
        { status: TRIP_STATUS.ONGOING, endDate: null },
        NOW,
      ),
    ).toBe(true);
  });

  it("stops counting a trip whose endDate has elapsed even though status was never flipped to past", () => {
    expect(
      isTripCountedAsActive(
        { status: TRIP_STATUS.ONGOING, endDate: PAST_DATE },
        NOW,
      ),
    ).toBe(false);
  });

  it("respects an explicit 'past' status even with no endDate to derive from", () => {
    expect(
      isTripCountedAsActive({ status: TRIP_STATUS.PAST, endDate: null }, NOW),
    ).toBe(false);
  });

  it("respects an explicit 'past' status even when endDate is still in the future", () => {
    // e.g. a trip cancelled before it started — the manual status wins and
    // derivation never pulls a trip back into counting.
    expect(
      isTripCountedAsActive(
        { status: TRIP_STATUS.PAST, endDate: FUTURE_DATE },
        NOW,
      ),
    ).toBe(false);
  });

  it("still counts a trip on its end date itself — the UTC calendar day isn't over yet", () => {
    expect(
      isTripCountedAsActive({ status: TRIP_STATUS.ONGOING, endDate: NOW }, NOW),
    ).toBe(true);
  });

  it("stops counting once the UTC calendar day after endDate has begun", () => {
    const startOfNextDay = new Date("2026-06-16T00:00:00.000Z");
    expect(
      isTripCountedAsActive(
        { status: TRIP_STATUS.ONGOING, endDate: NOW },
        startOfNextDay,
      ),
    ).toBe(false);
  });

  it("still counts a time-bearing endDate through the rest of its UTC calendar day", () => {
    // endDate carries a time component (e.g. a full ISO timestamp rather
    // than a date-only string) — the boundary is the calendar day, not
    // "endDate + 24h", so this must still count right up to UTC midnight.
    const endDateWithTime = new Date("2026-06-15T18:00:00.000Z");
    const lateSameDay = new Date("2026-06-15T23:59:59.000Z");
    expect(
      isTripCountedAsActive(
        { status: TRIP_STATUS.ONGOING, endDate: endDateWithTime },
        lateSameDay,
      ),
    ).toBe(true);
  });

  it("stops counting a time-bearing endDate once its UTC calendar day ends, even under 24h after the timestamp", () => {
    // 6 hours after the endDate instant, but past UTC midnight into the next
    // calendar day — "+24h from the instant" would still count this; the
    // calendar-day rule must not.
    const endDateWithTime = new Date("2026-06-15T18:00:00.000Z");
    const earlyNextDay = new Date("2026-06-16T00:00:01.000Z");
    expect(
      isTripCountedAsActive(
        { status: TRIP_STATUS.ONGOING, endDate: endDateWithTime },
        earlyNextDay,
      ),
    ).toBe(false);
  });

  it("treats a missing (undefined) endDate the same as null", () => {
    expect(
      isTripCountedAsActive(
        { status: TRIP_STATUS.UPCOMING, endDate: undefined },
        NOW,
      ),
    ).toBe(true);
  });
});

describe("deriveTripStatus", () => {
  it("keeps the stored status for a trip that still counts as active", () => {
    expect(
      deriveTripStatus(
        { status: TRIP_STATUS.ONGOING, endDate: FUTURE_DATE },
        NOW,
      ),
    ).toBe(TRIP_STATUS.ONGOING);
  });

  it("keeps 'upcoming' when there is no endDate to derive from", () => {
    expect(
      deriveTripStatus({ status: TRIP_STATUS.UPCOMING, endDate: null }, NOW),
    ).toBe(TRIP_STATUS.UPCOMING);
  });

  it("coerces a stale 'ongoing' trip to 'past' once its endDate has lapsed, without a write", () => {
    expect(
      deriveTripStatus(
        { status: TRIP_STATUS.ONGOING, endDate: PAST_DATE },
        NOW,
      ),
    ).toBe(TRIP_STATUS.PAST);
  });

  it("coerces a stale 'upcoming' trip to 'past' once its endDate has lapsed", () => {
    expect(
      deriveTripStatus(
        { status: TRIP_STATUS.UPCOMING, endDate: PAST_DATE },
        NOW,
      ),
    ).toBe(TRIP_STATUS.PAST);
  });

  it("leaves an explicit 'past' status untouched", () => {
    expect(
      deriveTripStatus({ status: TRIP_STATUS.PAST, endDate: FUTURE_DATE }, NOW),
    ).toBe(TRIP_STATUS.PAST);
  });

  it("never promotes 'upcoming' to 'ongoing' just because startDate has arrived — no such derivation exists", () => {
    // deriveTripStatus only ever coerces toward "past"; there is no rule in
    // this codebase (yet) that flips "upcoming" to "ongoing" once travel
    // starts, so the stored value passes through unchanged here.
    expect(
      deriveTripStatus(
        { status: TRIP_STATUS.UPCOMING, endDate: FUTURE_DATE },
        NOW,
      ),
    ).toBe(TRIP_STATUS.UPCOMING);
  });
});

describe("withDerivedStatus", () => {
  it("overwrites status with the derived value while preserving every other field", () => {
    const trip = {
      id: "trip-1",
      name: "Stale Trip",
      status: TRIP_STATUS.ONGOING,
      endDate: PAST_DATE,
    };

    expect(withDerivedStatus(trip, NOW)).toEqual({
      ...trip,
      status: TRIP_STATUS.PAST,
    });
  });

  it("leaves the object unchanged (aside from status) when the stored status is already current", () => {
    const trip = {
      id: "trip-2",
      name: "Live Trip",
      status: TRIP_STATUS.UPCOMING,
      endDate: FUTURE_DATE,
    };

    expect(withDerivedStatus(trip, NOW)).toEqual(trip);
  });
});

describe("lapsedEndDateCutoff", () => {
  it("returns the UTC start of the given day, discarding any time-of-day component", () => {
    const midDay = new Date("2026-06-15T18:32:04.000Z");
    expect(lapsedEndDateCutoff(midDay).toISOString()).toBe(
      "2026-06-15T00:00:00.000Z",
    );
  });

  it("agrees with isTripCountedAsActive at the exact UTC-midnight boundary", () => {
    // NOW is itself UTC midnight, so its cutoff equals NOW: an endDate that
    // falls on the previous calendar day (one ms before the cutoff) has
    // lapsed; an endDate exactly at the cutoff is still on today's calendar
    // day and has not. This is exactly the `lt` comparison index.get.ts's SQL
    // filter runs against this cutoff, so it must agree with
    // isTripCountedAsActive's per-row (endDate-day-based) derivation.
    const cutoff = lapsedEndDateCutoff(NOW);
    const justBeforeCutoff = new Date(cutoff.getTime() - 1);

    expect(
      isTripCountedAsActive(
        { status: TRIP_STATUS.ONGOING, endDate: justBeforeCutoff },
        NOW,
      ),
    ).toBe(false);

    expect(
      isTripCountedAsActive(
        { status: TRIP_STATUS.ONGOING, endDate: cutoff },
        NOW,
      ),
    ).toBe(true);
  });
});
