/**
 * Maps the app's internal map style keys to real Mapbox style URLs.
 * Centralised here so both the map component and tests can import the same
 * mapping without coupling to mapbox-gl itself.
 */

const MAPBOX_STYLE_URLS: Record<string, string> = {
  outdoors: "mapbox://styles/mapbox/outdoors-v12",
  streets: "mapbox://styles/mapbox/streets-v12",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
  light: "mapbox://styles/mapbox/light-v11",
  dark: "mapbox://styles/mapbox/dark-v11",
  // "custom" uses the Outdoors base until a published FarFlung custom style exists.
  // Replace this URL with the real style ID once it is published to Mapbox Studio.
  custom: "mapbox://styles/mapbox/outdoors-v12",
};

const MAPBOX_STYLE_LABELS: Record<string, string> = {
  outdoors: "outdoors-v12",
  streets: "streets-v12",
  satellite: "satellite-streets-v12",
  light: "light-v11",
  dark: "dark-v11",
  custom: "farflung-violet",
};

export function resolveMapboxStyleUrl(styleKey: string): string {
  return MAPBOX_STYLE_URLS[styleKey] ?? MAPBOX_STYLE_URLS.outdoors;
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
