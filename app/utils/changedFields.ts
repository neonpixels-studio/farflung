/**
 * The entries of `current` whose value differs from `saved`. Settings sends
 * only these, so saving one field never trips a plan check (or a uniqueness
 * check) on a field the user didn't touch.
 */
export function pickChangedFields<T extends Record<string, unknown>>(
  current: T,
  saved: T,
): Partial<T> {
  const changed: Partial<T> = {};
  for (const key of Object.keys(current) as (keyof T)[]) {
    if (current[key] !== saved[key]) {
      changed[key] = current[key];
    }
  }
  return changed;
}
