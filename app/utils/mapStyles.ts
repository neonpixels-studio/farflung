/**
 * Map style choices and which of them each plan may use, shared by the map's
 * style picker and Settings > Default map style.
 */

export const DEFAULT_MAP_STYLE = "outdoors";

export const MAP_STYLE_OPTIONS = [
  { value: "outdoors", label: "Outdoors" },
  { value: "streets", label: "Streets" },
  { value: "satellite", label: "Satellite" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "custom", label: "FarFlung violet" },
];

// Mirrors PLAN_LIMITS[drifter].mapStyles on the server (a test pins them
// together). The server remains the authority; this only decides what the UI
// offers.
const DRIFTER_MAP_STYLES = [DEFAULT_MAP_STYLE];

export const PAID_MAP_STYLE_HINT = "Available on Wanderer and Nomad";

export function isMapStyleAllowed(plan: string, style: string): boolean {
  return plan !== "drifter" || DRIFTER_MAP_STYLES.includes(style);
}

/**
 * The style the map should open with: the saved default, unless it is unset,
 * unknown, or no longer allowed on the user's current plan (e.g. after a
 * downgrade), in which case the stock outdoors style.
 */
export function resolveDefaultMapStyle(
  savedStyle: string | null,
  plan: string,
): string {
  const isKnown = MAP_STYLE_OPTIONS.some(
    (option) => option.value === savedStyle,
  );
  if (!savedStyle || !isKnown || !isMapStyleAllowed(plan, savedStyle)) {
    return DEFAULT_MAP_STYLE;
  }
  return savedStyle;
}
