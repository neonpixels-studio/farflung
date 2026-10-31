import { describe, it, expect } from "vitest";
import {
  FALLBACK_TRAVELER_NAME,
  resolveClerkDisplayName,
} from "../clerkDisplayName";

describe("resolveClerkDisplayName", () => {
  it("uses Clerk's full name (first + last)", () => {
    expect(
      resolveClerkDisplayName({
        fullName: "Dan Holloran",
        username: "danh",
      }),
    ).toBe("Dan Holloran");
  });

  it("shows just the first name for a user with no last name", () => {
    expect(resolveClerkDisplayName({ fullName: "Cher", username: null })).toBe(
      "Cher",
    );
  });

  it("falls back to the username, then to a generic name", () => {
    expect(resolveClerkDisplayName({ fullName: null, username: "danh" })).toBe(
      "danh",
    );
    expect(resolveClerkDisplayName({ fullName: "", username: null })).toBe(
      FALLBACK_TRAVELER_NAME,
    );
  });

  it("falls back to the generic name before the user has loaded", () => {
    expect(resolveClerkDisplayName(null)).toBe(FALLBACK_TRAVELER_NAME);
    expect(resolveClerkDisplayName(undefined)).toBe(FALLBACK_TRAVELER_NAME);
  });
});
