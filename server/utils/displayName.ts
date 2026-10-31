export const NAME_PART_MAX_LENGTH = 50;

/**
 * The stored `user_preferences.display_name`, derived from Clerk's first and
 * last name. Profiles, guides, search and notifications read that column, so it
 * is always composed here rather than typed in by hand. A missing last name
 * yields just the first name, with no trailing space.
 */
export function composeDisplayName(
  firstName: string,
  lastName: string | null | undefined,
): string {
  return [firstName, lastName]
    .map((part) => (part ?? "").trim())
    .filter((part) => part !== "")
    .join(" ");
}
