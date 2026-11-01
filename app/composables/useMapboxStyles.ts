/**
 * Maps the app's internal map style keys to real Mapbox style URLs.
 * Centralised here so both the map component and tests can import the same
 * mapping without coupling to mapbox-gl itself.
 */

const DEFAULT_MAPBOX_STYLE_URL = "mapbox://styles/mapbox/outdoors-v12";

const MAPBOX_STYLE_URLS: Record<string, string> = {
  outdoors: DEFAULT_MAPBOX_STYLE_URL,
  streets: "mapbox://styles/mapbox/streets-v12",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
  light: "mapbox://styles/mapbox/light-v11",
  dark: "mapbox://styles/mapbox/dark-v11",
  // "custom" (FarFlung violet) is the stock light style recoloured at runtime on
  // every style load; see mapboxBrandStyle.ts and useMapbox.ts.
  custom: "mapbox://styles/mapbox/light-v11",
};

export const BRAND_STYLE_KEY = "custom";

const MAPBOX_STYLE_LABELS: Record<string, string> = {
  outdoors: "outdoors-v12",
  streets: "streets-v12",
  satellite: "satellite-streets-v12",
  light: "light-v11",
  dark: "dark-v11",
  custom: "farflung-violet",
};

export function resolveMapboxStyleUrl(styleKey: string): string {
  return MAPBOX_STYLE_URLS[styleKey] ?? DEFAULT_MAPBOX_STYLE_URL;
}

export function resolveMapboxStyleLabel(styleKey: string): string {
  return MAPBOX_STYLE_LABELS[styleKey] ?? styleKey;
}

export function useMapboxStyles() {
  return {
    resolveMapboxStyleUrl,
    resolveMapboxStyleLabel,
    MAPBOX_STYLE_URLS,
    MAPBOX_STYLE_LABELS,
  };
}
