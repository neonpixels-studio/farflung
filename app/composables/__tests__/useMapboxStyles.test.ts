import { describe, it, expect } from "vitest";
import {
  resolveMapboxStyleUrl,
  resolveMapboxStyleLabel,
  useMapboxStyles,
} from "../useMapboxStyles";

describe("resolveMapboxStyleUrl", () => {
  it("returns the outdoors style URL for the outdoors key", () => {
    expect(resolveMapboxStyleUrl("outdoors")).toBe(
      "mapbox://styles/mapbox/outdoors-v12",
    );
  });

  it("returns the streets style URL for the streets key", () => {
    expect(resolveMapboxStyleUrl("streets")).toBe(
      "mapbox://styles/mapbox/streets-v12",
    );
  });

  it("returns the satellite style URL for the satellite key", () => {
    expect(resolveMapboxStyleUrl("satellite")).toBe(
      "mapbox://styles/mapbox/satellite-streets-v12",
    );
  });

  it("returns the light style URL for the light key", () => {
    expect(resolveMapboxStyleUrl("light")).toBe(
      "mapbox://styles/mapbox/light-v11",
    );
  });

  it("returns the dark style URL for the dark key", () => {
    expect(resolveMapboxStyleUrl("dark")).toBe(
      "mapbox://styles/mapbox/dark-v11",
    );
  });

  it("returns a mapbox style URL for the custom key (falls back to outdoors base)", () => {
    const url = resolveMapboxStyleUrl("custom");
    expect(url).toMatch(/^mapbox:\/\/styles\//);
  });

  it("falls back to the outdoors URL for an unknown key", () => {
    expect(resolveMapboxStyleUrl("unknown-style")).toBe(
      "mapbox://styles/mapbox/outdoors-v12",
    );
  });
});

describe("resolveMapboxStyleLabel", () => {
  it("returns outdoors-v12 for the outdoors key", () => {
    expect(resolveMapboxStyleLabel("outdoors")).toBe("outdoors-v12");
  });

  it("returns streets-v12 for the streets key", () => {
    expect(resolveMapboxStyleLabel("streets")).toBe("streets-v12");
  });

  it("returns satellite-streets-v12 for the satellite key", () => {
    expect(resolveMapboxStyleLabel("satellite")).toBe("satellite-streets-v12");
  });

  it("returns light-v11 for the light key", () => {
    expect(resolveMapboxStyleLabel("light")).toBe("light-v11");
  });

  it("returns dark-v11 for the dark key", () => {
    expect(resolveMapboxStyleLabel("dark")).toBe("dark-v11");
  });

  it("returns farflung-violet for the custom key", () => {
    expect(resolveMapboxStyleLabel("custom")).toBe("farflung-violet");
  });

  it("falls back to the raw key for unknown styles", () => {
    expect(resolveMapboxStyleLabel("mystery-style")).toBe("mystery-style");
  });
});

describe("useMapboxStyles", () => {
  it("exposes MAPBOX_STYLE_URLS with all 6 entries", () => {
    const { MAPBOX_STYLE_URLS } = useMapboxStyles();
    const keys = Object.keys(MAPBOX_STYLE_URLS);
    expect(keys).toEqual(
      expect.arrayContaining([
        "outdoors",
        "streets",
        "satellite",
        "light",
        "dark",
        "custom",
      ]),
    );
    expect(keys).toHaveLength(6);
  });

  it("exposes MAPBOX_STYLE_LABELS with all 6 entries", () => {
    const { MAPBOX_STYLE_LABELS } = useMapboxStyles();
    const keys = Object.keys(MAPBOX_STYLE_LABELS);
    expect(keys).toHaveLength(6);
  });

  it("re-exports resolveMapboxStyleUrl", () => {
    const { resolveMapboxStyleUrl: fn } = useMapboxStyles();
    expect(fn("outdoors")).toBe("mapbox://styles/mapbox/outdoors-v12");
  });

  it("re-exports resolveMapboxStyleLabel", () => {
    const { resolveMapboxStyleLabel: fn } = useMapboxStyles();
    expect(fn("dark")).toBe("dark-v11");
  });
});
