export const FALLBACK_TRAVELER_NAME = "Traveler";

interface NamedClerkUser {
  fullName?: string | null;
  username?: string | null;
}

/**
 * The name shown for the signed-in user in the sidebar and the home greeting:
 * Clerk's first + last name (fullName, which is just the first name for a user
 * with no last name), then their username, then a generic fallback. One helper
 * so the two places can't disagree.
 */
export function resolveClerkDisplayName(
  user: NamedClerkUser | null | undefined,
): string {
  return user?.fullName || user?.username || FALLBACK_TRAVELER_NAME;
}
