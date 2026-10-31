/**
 * Public handle rules, shared by the preferences route, the availability check
 * and the settings form so all three agree on what a valid handle is.
 *
 * Handles are case-insensitive: "Grimicorn" and "grimicorn" are the same
 * handle (uniqueness is enforced on lower(handle), see schema.ts) and the
 * casing the user typed is kept for display.
 */

export const HANDLE_MIN_LENGTH = 3;
export const HANDLE_MAX_LENGTH = 30;

// Letters, digits, hyphen and underscore; must start and end with a letter or
// digit so a handle never reads as punctuation in `/@handle`.
const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/i;

// Words that would be confusing or unsafe as a public name: app routes,
// infrastructure names and impersonation bait. Compared lowercased.
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  "about",
  "account",
  "activity",
  "admin",
  "administrator",
  "api",
  "app",
  "auth",
  "billing",
  "blog",
  "contact",
  "dashboard",
  "delete",
  "discover",
  "edit",
  "explore",
  "farflung",
  "feedback",
  "follow",
  "followers",
  "following",
  "guides",
  "help",
  "home",
  "journal",
  "login",
  "logout",
  "map",
  "new",
  "notifications",
  "null",
  "pricing",
  "privacy",
  "profile",
  "root",
  "search",
  "settings",
  "signin",
  "signout",
  "signup",
  "staff",
  "support",
  "terms",
  "trips",
  "undefined",
  "user",
  "users",
  "webhooks",
  "www",
]);

export type HandleProblem =
  "too_short" | "too_long" | "invalid_characters" | "reserved";

const HANDLE_PROBLEM_MESSAGES: Record<HandleProblem, string> = {
  too_short: `Handle must be at least ${HANDLE_MIN_LENGTH} characters`,
  too_long: `Handle must be at most ${HANDLE_MAX_LENGTH} characters`,
  invalid_characters:
    "Handle can only use letters, numbers, hyphens and underscores, and must start and end with a letter or number",
  reserved: "That handle is reserved",
};

export function describeHandleProblem(problem: HandleProblem): string {
  return HANDLE_PROBLEM_MESSAGES[problem];
}

/** Returns the first rule the handle breaks, or null when it is valid. */
export function findHandleProblem(handle: string): HandleProblem | null {
  if (handle.length < HANDLE_MIN_LENGTH) {
    return "too_short";
  }
  if (handle.length > HANDLE_MAX_LENGTH) {
    return "too_long";
  }
  if (!HANDLE_PATTERN.test(handle)) {
    return "invalid_characters";
  }
  if (RESERVED_HANDLES.has(handle.toLowerCase())) {
    return "reserved";
  }
  return null;
}

export function isValidHandle(handle: string): boolean {
  return findHandleProblem(handle) === null;
}
