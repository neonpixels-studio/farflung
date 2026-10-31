import { kmToMi } from "../../server/utils/distance";

export type DistanceUnit = "mi" | "km";

/**
 * Formats a distance stored in kilometres (the unit trips and stops are saved
 * in) for display in the viewer's preferred unit, e.g. "483 mi" or "777 km".
 */
export function formatDistanceKm(
  distanceKm: number,
  unit: DistanceUnit,
): string {
  const value = unit === "mi" ? kmToMi(distanceKm) : distanceKm;
  const rounded = value.toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });
  return `${rounded} ${unit}`;
}
