/**
 * Pure distance helpers with no server dependencies, so the stats queries and
 * the client-side distance formatting (app/utils/formatDistance.ts) share one
 * conversion factor.
 */

const KM_TO_MI = 0.621371;

/**
 * Converts kilometres to miles. Returns a full-precision float; callers are
 * expected to format the result (e.g. via formatCompact) before display.
 */
export function kmToMi(km: number): number {
  return km * KM_TO_MI;
}
