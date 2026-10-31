/**
 * "FarFlung violet": the brand map style, built at runtime on top of Mapbox's
 * stock light style by recolouring water, land and roads on style load. No
 * Mapbox Studio style is involved, so it works with only the public token.
 *
 * Layers are classified by type and id prefix rather than a hard-coded id
 * list, so a minor change to the stock style's layer set degrades to "that
 * layer keeps its stock colour" instead of throwing.
 */
import type mapboxgl from "mapbox-gl";

export const FARFLUNG_VIOLET_PALETTE = {
  land: "#f0e6fd",
  landUse: "#e6d4fb",
  building: "#e1d3f6",
  water: "#bda4ee",
  road: "#ffffff",
  roadMajor: "#d3b8f7",
  roadCasing: "#d9c6f5",
} as const;

type StyleMap = Pick<mapboxgl.Map, "getStyle" | "setPaintProperty">;
type StyleLayer = { id: string; type: string };
type PaintProperty = "background-color" | "fill-color" | "line-color";
type PaintChange = [PaintProperty, string];

const LAND_USE_PATTERN = /^(landcover|landuse|national-park|park|pitch)/;
const MAJOR_ROAD_PATTERN = /(motorway|trunk|primary)/;
const ROAD_PATTERN = /^(road|bridge|tunnel)-/;
const CASING_PATTERN = /(-case|-casing|-outline)$/;

function paintFor(layer: StyleLayer): PaintChange | null {
  if (layer.type === "background") {
    return ["background-color", FARFLUNG_VIOLET_PALETTE.land];
  }
  if (layer.type === "fill") {
    return fillPaintFor(layer.id);
  }
  if (layer.type === "line") {
    return linePaintFor(layer.id);
  }
  return null;
}

function fillPaintFor(id: string): PaintChange | null {
  if (id.startsWith("water")) {
    return ["fill-color", FARFLUNG_VIOLET_PALETTE.water];
  }
  if (id.startsWith("building")) {
    return ["fill-color", FARFLUNG_VIOLET_PALETTE.building];
  }
  if (LAND_USE_PATTERN.test(id)) {
    return ["fill-color", FARFLUNG_VIOLET_PALETTE.landUse];
  }
  if (id === "land") {
    return ["fill-color", FARFLUNG_VIOLET_PALETTE.land];
  }
  return null;
}

function linePaintFor(id: string): PaintChange | null {
  if (id.startsWith("waterway")) {
    return ["line-color", FARFLUNG_VIOLET_PALETTE.water];
  }
  if (!ROAD_PATTERN.test(id)) {
    return null;
  }
  if (CASING_PATTERN.test(id)) {
    return ["line-color", FARFLUNG_VIOLET_PALETTE.roadCasing];
  }
  if (MAJOR_ROAD_PATTERN.test(id)) {
    return ["line-color", FARFLUNG_VIOLET_PALETTE.roadMajor];
  }
  return ["line-color", FARFLUNG_VIOLET_PALETTE.road];
}

function recolourLayer(map: StyleMap, layer: StyleLayer): void {
  const paint = paintFor(layer);
  if (!paint) {
    return;
  }
  try {
    map.setPaintProperty(layer.id, paint[0], paint[1]);
  } catch (error) {
    console.error(`Could not recolour map layer "${layer.id}"`, error);
  }
}

/**
 * Recolours the currently loaded style. Call after every style load: swapping
 * styles (map.setStyle) discards runtime paint changes. Individual layer
 * failures are logged and skipped so one odd layer can't leave the map
 * half-themed with an uncaught error.
 */
export function applyFarflungVioletTheme(map: StyleMap): void {
  const layers = (map.getStyle()?.layers ?? []) as StyleLayer[];
  layers.forEach((layer) => recolourLayer(map, layer));
}
