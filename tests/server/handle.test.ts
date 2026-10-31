import { describe, it, expect } from "vitest";
import {
  HANDLE_MAX_LENGTH,
  HANDLE_MIN_LENGTH,
  RESERVED_HANDLES,
  describeHandleProblem,
  findHandleProblem,
  isValidHandle,
} from "../../server/utils/handle";

describe("findHandleProblem", () => {
  it.each(["dan", "Grimicorn", "dan-h", "dan_h", "a1b", "x".repeat(30)])(
    "accepts %s",
    (handle) => {
      expect(findHandleProblem(handle)).toBeNull();
    },
  );

  it("enforces the minimum length", () => {
    expect(findHandleProblem("a".repeat(HANDLE_MIN_LENGTH - 1))).toBe(
      "too_short",
    );
    expect(findHandleProblem("a".repeat(HANDLE_MIN_LENGTH))).toBeNull();
  });

  it("enforces the maximum length", () => {
    expect(findHandleProblem("a".repeat(HANDLE_MAX_LENGTH + 1))).toBe(
      "too_long",
    );
    expect(findHandleProblem("a".repeat(HANDLE_MAX_LENGTH))).toBeNull();
  });

  it.each([
    "has space",
    "emoji🙂",
    "dot.ted",
    "slash/es",
    "@dan",
    "-lead",
    "trail-",
    "_lead",
    "trail_",
    "dán",
  ])("rejects %s as invalid characters", (handle) => {
    expect(findHandleProblem(handle)).toBe("invalid_characters");
  });

  it("rejects reserved words in any casing", () => {
    expect(findHandleProblem("admin")).toBe("reserved");
    expect(findHandleProblem("Admin")).toBe("reserved");
    expect(findHandleProblem("SETTINGS")).toBe("reserved");
  });

  it("reserves every top-level app route so a handle can never shadow one", () => {
    const appRoutes = [
      "activity",
      "contact",
      "explore",
      "guides",
      "home",
      "journal",
      "login",
      "map",
      "pricing",
      "privacy",
      "settings",
      "terms",
      "trips",
      "api",
    ];
    for (const route of appRoutes) {
      expect(RESERVED_HANDLES.has(route), route).toBe(true);
    }
  });

  it("keeps every reserved word long enough to matter", () => {
    for (const word of RESERVED_HANDLES) {
      expect(word.length, word).toBeGreaterThanOrEqual(HANDLE_MIN_LENGTH);
    }
  });
});

describe("isValidHandle", () => {
  it("mirrors findHandleProblem", () => {
    expect(isValidHandle("grimicorn")).toBe(true);
    expect(isValidHandle("no spaces")).toBe(false);
    expect(isValidHandle("admin")).toBe(false);
  });
});

describe("describeHandleProblem", () => {
  it("gives a distinct, human message for each problem", () => {
    const messages = [
      describeHandleProblem("too_short"),
      describeHandleProblem("too_long"),
      describeHandleProblem("invalid_characters"),
      describeHandleProblem("reserved"),
    ];
    expect(new Set(messages).size).toBe(4);
  });
});
