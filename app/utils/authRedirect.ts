// Deliberately NOT named "redirect_url": Clerk's own SDK treats redirect_url
// (and its sign_in_force_redirect_url / sign_in_fallback_redirect_url /
// sign_up_*_redirect_url siblings) as a reserved query param it reads
// directly off the URL (see @clerk/shared's clerk-js constants), taking
// priority over whatever this app passes as a component prop. Reusing that
// name here would mean an untrusted value could reach Clerk's own redirect
// handling before (or instead of) the validation in getSafeRedirectPath ever
// ran. return_to is app-owned and only ever read by login.vue below.
export const AUTH_REDIRECT_QUERY_PARAM = "return_to";

const LOGIN_PATH = "/login";

// Any origin works here: getSafeRedirectPath only ever inspects the parsed
// path/search/hash and compares parsed.origin back against this same
// constant, so the specific value is never observed outside this module.
const VALIDATION_BASE_ORIGIN = "https://redirect-validation.invalid";

/**
 * Builds a /login path that carries the current location as a redirect-back
 * query param, so an authenticating visitor lands back on what they clicked
 * from instead of the default post-login destination (#292). Used by every
 * "sign in to ..." link across profile/trips (guides has no sign-in link to
 * wire up yet — its detail page never gates content behind auth).
 *
 * currentPath is expected to be a same-origin path (e.g. Vue Router's
 * route.fullPath), never an absolute URL, so no origin/protocol validation
 * happens here — that validation lives in getSafeRedirectPath, which guards
 * the untrusted value coming back off the query string on the login page.
 */
export function buildLoginPath(currentPath: string): string {
  if (!currentPath || currentPath === LOGIN_PATH) {
    return LOGIN_PATH;
  }
  return `${LOGIN_PATH}?${AUTH_REDIRECT_QUERY_PARAM}=${encodeURIComponent(currentPath)}`;
}

/**
 * Validates an untrusted return_to query value before it's ever used to
 * navigate, so a crafted /login?return_to=https://evil.com (or a
 * protocol-relative //evil.com, or a value a browser's URL parser would
 * normalize into one — a backslash variant like /\evil.com, or one hiding a
 * stripped tab/newline like "/\t/evil.com") can't turn the sign-in flow into
 * an open redirect. Parses rawValue against a fixed placeholder origin using
 * the same WHATWG URL algorithm a browser uses, then requires the parsed
 * origin to still match that placeholder — i.e. rawValue must resolve to a
 * same-origin path, never a different host. Only the path/search/hash is
 * returned; the placeholder origin itself is never part of the output.
 */
export function getSafeRedirectPath(rawValue: unknown): string | null {
  if (typeof rawValue !== "string" || !rawValue.startsWith("/")) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(rawValue, VALIDATION_BASE_ORIGIN);
  } catch {
    return null;
  }
  if (parsed.origin !== VALIDATION_BASE_ORIGIN) {
    return null;
  }
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
