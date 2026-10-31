import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  FARFLUNG_VIOLET_PALETTE,
  applyFarflungVioletTheme,
} from "../mapboxBrandStyle";

const mockSetPaintProperty = vi.fn();
const mockGetStyle = vi.fn();

function fakeMap(): Parameters<typeof applyFarflungVioletTheme>[0] {
  return {
    getStyle: mockGetStyle,
    setPaintProperty: mockSetPaintProperty,
  } as never;
}

function paintedWith(layerId: string): unknown[] | undefined {
  return mockSetPaintProperty.mock.calls.find(
    ([candidate]) => candidate === layerId,
  );
}

describe("applyFarflungVioletTheme", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("recolours the land background", () => {
    mockGetStyle.mockReturnValue({
      layers: [{ id: "land", type: "background" }],
    });

    applyFarflungVioletTheme(fakeMap());

    expect(paintedWith("land")).toEqual([
      "land",
      "background-color",
      FARFLUNG_VIOLET_PALETTE.land,
    ]);
  });

  it("recolours water fills and waterways with the water colour", () => {
    mockGetStyle.mockReturnValue({
      layers: [
        { id: "water", type: "fill" },
        { id: "water-shadow", type: "fill" },
        { id: "waterway", type: "line" },
      ],
    });

    applyFarflungVioletTheme(fakeMap());

    expect(paintedWith("water")?.slice(1)).toEqual([
      "fill-color",
      FARFLUNG_VIOLET_PALETTE.water,
    ]);
    expect(paintedWith("water-shadow")?.slice(1)).toEqual([
      "fill-color",
      FARFLUNG_VIOLET_PALETTE.water,
    ]);
    expect(paintedWith("waterway")?.slice(1)).toEqual([
      "line-color",
      FARFLUNG_VIOLET_PALETTE.water,
    ]);
  });

  it("recolours land cover and land use with the land-use colour", () => {
    mockGetStyle.mockReturnValue({
      layers: [
        { id: "landcover", type: "fill" },
        { id: "national-park", type: "fill" },
        { id: "landuse", type: "fill" },
      ],
    });

    applyFarflungVioletTheme(fakeMap());

    for (const layerId of ["landcover", "national-park", "landuse"]) {
      expect(paintedWith(layerId)?.[2], layerId).toBe(
        FARFLUNG_VIOLET_PALETTE.landUse,
      );
    }
  });

  it("recolours roads: plain roads, major roads and casings differ", () => {
    mockGetStyle.mockReturnValue({
      layers: [
        { id: "road-street", type: "line" },
        { id: "road-primary", type: "line" },
        { id: "road-motorway-trunk", type: "line" },
        { id: "road-street-case", type: "line" },
        { id: "bridge-street", type: "line" },
        { id: "tunnel-street", type: "line" },
      ],
    });

    applyFarflungVioletTheme(fakeMap());

    expect(paintedWith("road-street")?.[2]).toBe(FARFLUNG_VIOLET_PALETTE.road);
    expect(paintedWith("bridge-street")?.[2]).toBe(
      FARFLUNG_VIOLET_PALETTE.road,
    );
    expect(paintedWith("tunnel-street")?.[2]).toBe(
      FARFLUNG_VIOLET_PALETTE.road,
    );
    expect(paintedWith("road-primary")?.[2]).toBe(
      FARFLUNG_VIOLET_PALETTE.roadMajor,
    );
    expect(paintedWith("road-motorway-trunk")?.[2]).toBe(
      FARFLUNG_VIOLET_PALETTE.roadMajor,
    );
    expect(paintedWith("road-street-case")?.[2]).toBe(
      FARFLUNG_VIOLET_PALETTE.roadCasing,
    );
  });

  it("leaves labels, symbols and unrecognised layers alone so text stays legible", () => {
    mockGetStyle.mockReturnValue({
      layers: [
        { id: "settlement-label", type: "symbol" },
        { id: "road-label", type: "symbol" },
        { id: "admin-0-boundary", type: "line" },
        { id: "hillshade", type: "fill" },
      ],
    });

    applyFarflungVioletTheme(fakeMap());

    expect(mockSetPaintProperty).not.toHaveBeenCalled();
  });

  it("does nothing, without throwing, when no style is loaded yet", () => {
    mockGetStyle.mockReturnValue(undefined);

    expect(() => applyFarflungVioletTheme(fakeMap())).not.toThrow();
    expect(mockSetPaintProperty).not.toHaveBeenCalled();
  });

  it("logs and skips a layer that rejects the paint change, still recolouring the rest", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockGetStyle.mockReturnValue({
      layers: [
        { id: "water", type: "fill" },
        { id: "land", type: "background" },
      ],
    });
    mockSetPaintProperty.mockImplementationOnce(() => {
      throw new Error("no such layer");
    });

    expect(() => applyFarflungVioletTheme(fakeMap())).not.toThrow();

    expect(consoleError).toHaveBeenCalled();
    expect(paintedWith("land")).toBeDefined();
  });

  it("uses palette colours that are all distinct violet-family hex values", () => {
    const values = Object.values(FARFLUNG_VIOLET_PALETTE);
    for (const value of values) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(FARFLUNG_VIOLET_PALETTE.water).not.toBe(
      FARFLUNG_VIOLET_PALETTE.land,
    );
  });
});
