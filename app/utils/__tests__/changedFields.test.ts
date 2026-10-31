import { describe, it, expect } from "vitest";
import { pickChangedFields } from "../changedFields";

describe("pickChangedFields", () => {
  const saved = {
    bio: "Hi",
    publicProfile: false,
    handle: null as string | null,
  };

  it("returns only the entries that differ", () => {
    expect(pickChangedFields({ ...saved, bio: "New" }, saved)).toEqual({
      bio: "New",
    });
  });

  it("returns an empty object when nothing changed", () => {
    expect(pickChangedFields({ ...saved }, saved)).toEqual({});
  });

  it("includes a field cleared to null", () => {
    expect(
      pickChangedFields(
        { ...saved, handle: null },
        { ...saved, handle: "dan" },
      ),
    ).toEqual({ handle: null });
  });

  it("treats false as a real value, not as unchanged-by-default", () => {
    expect(
      pickChangedFields(
        { ...saved, publicProfile: false },
        { ...saved, publicProfile: true },
      ),
    ).toEqual({ publicProfile: false });
  });

  it("does not include untouched paid-only fields when an unrelated one changes", () => {
    const changed = pickChangedFields(
      { ...saved, bio: "Edited", publicProfile: false },
      { ...saved, publicProfile: false },
    );
    expect(Object.keys(changed)).toEqual(["bio"]);
  });
});
