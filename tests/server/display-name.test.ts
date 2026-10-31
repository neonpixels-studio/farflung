import { describe, it, expect } from "vitest";
import { composeDisplayName } from "../../server/utils/displayName";

describe("composeDisplayName", () => {
  it("joins first and last name with a single space", () => {
    expect(composeDisplayName("Dan", "Holloran")).toBe("Dan Holloran");
  });

  it.each([null, undefined, "", "   "])(
    "returns just the first name when the last name is %j (no trailing space)",
    (lastName) => {
      expect(composeDisplayName("Dan", lastName)).toBe("Dan");
    },
  );

  it("trims each part", () => {
    expect(composeDisplayName(" Dan ", " Holloran ")).toBe("Dan Holloran");
  });
});
