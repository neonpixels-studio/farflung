import { describe, it, expect } from "vitest";
import { MAP_STYLES, PLAN_LIMITS } from "../../../server/utils/planLimits";
import {
  DEFAULT_MAP_STYLE,
  MAP_STYLE_OPTIONS,
  isMapStyleAllowed,
  resolveDefaultMapStyle,
} from "../mapStyles";

describe("map style mirror of the server's plan limits", () => {
  it("offers exactly the styles the server accepts", () => {
    expect(MAP_STYLE_OPTIONS.map((option) => option.value)).toEqual([
      ...MAP_STYLES,
    ]);
  });

  it("allows a Drifter exactly the styles the server allows", () => {
    const allowed = MAP_STYLE_OPTIONS.filter((option) =>
      isMapStyleAllowed("drifter", option.value),
    ).map((option) => option.value);
    expect(allowed).toEqual([...PLAN_LIMITS.drifter.mapStyles]);
  });

  it("allows every style on paid plans, as the server does", () => {
    for (const plan of ["wanderer", "nomad"] as const) {
      for (const option of MAP_STYLE_OPTIONS) {
        expect(isMapStyleAllowed(plan, option.value)).toBe(
          PLAN_LIMITS[plan].mapStyles.includes(option.value as never),
        );
      }
    }
  });
});

describe("resolveDefaultMapStyle", () => {
  it("uses the saved style when the plan allows it", () => {
    expect(resolveDefaultMapStyle("dark", "wanderer")).toBe("dark");
    expect(resolveDefaultMapStyle("custom", "nomad")).toBe("custom");
  });

  it("falls back to outdoors when nothing is saved", () => {
    expect(resolveDefaultMapStyle(null, "nomad")).toBe(DEFAULT_MAP_STYLE);
  });

  it("falls back to outdoors when the plan no longer allows the saved style", () => {
    expect(resolveDefaultMapStyle("satellite", "drifter")).toBe(
      DEFAULT_MAP_STYLE,
    );
  });

  it("keeps outdoors for a Drifter who saved it", () => {
    expect(resolveDefaultMapStyle("outdoors", "drifter")).toBe("outdoors");
  });

  it("falls back to outdoors for a style that no longer exists", () => {
    expect(resolveDefaultMapStyle("retro", "nomad")).toBe(DEFAULT_MAP_STYLE);
  });
});
