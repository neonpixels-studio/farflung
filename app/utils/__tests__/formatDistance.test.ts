import { describe, it, expect } from "vitest";
import { formatDistanceKm } from "../formatDistance";

describe("formatDistanceKm", () => {
  it("shows kilometres as stored, rounded to a whole number", () => {
    expect(formatDistanceKm(892, "km")).toBe("892 km");
    expect(formatDistanceKm(892.6, "km")).toBe("893 km");
  });

  it("converts to miles for the mi unit", () => {
    // 892 km * 0.621371 = 554.2 mi
    expect(formatDistanceKm(892, "mi")).toBe("554 mi");
    expect(formatDistanceKm(100, "mi")).toBe("62 mi");
  });

  it("formats zero in both units", () => {
    expect(formatDistanceKm(0, "km")).toBe("0 km");
    expect(formatDistanceKm(0, "mi")).toBe("0 mi");
  });

  it("groups thousands", () => {
    expect(formatDistanceKm(1332, "km")).toBe("1,332 km");
    expect(formatDistanceKm(1332, "mi")).toBe("828 mi");
    expect(formatDistanceKm(77600, "mi")).toBe("48,218 mi");
  });
});
