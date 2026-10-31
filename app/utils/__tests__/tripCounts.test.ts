import { describe, it, expect } from "vitest";
import { summarizeTripCounts } from "../tripCounts";

describe("summarizeTripCounts", () => {
  it("returns a neutral line with no trips", () => {
    expect(summarizeTripCounts([])).toBe(
      "Plan a route, log the journey, look back on it later.",
    );
  });

  it("counts each status from the real trips", () => {
    const trips = [
      { status: "ongoing" as const },
      { status: "upcoming" as const },
      { status: "upcoming" as const },
      { status: "past" as const },
      { status: "past" as const },
      { status: "past" as const },
    ];

    expect(summarizeTripCounts(trips)).toBe(
      "1 ongoing, 2 on the calendar, 3 in the books.",
    );
  });

  it("leaves out statuses that have no trips", () => {
    expect(summarizeTripCounts([{ status: "past" }, { status: "past" }])).toBe(
      "2 in the books.",
    );
  });
});
