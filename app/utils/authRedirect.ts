// Deliberately NOT named "redirect_url": Clerk's own SDK treats redirect_url
// (and its sign_in_force_redirect_url / sign_in_fallback_redirect_url /
// sign_up_*_redirect_url siblings) as a reserved query param it reads
// directly off the URL (see @clerk/shared's clerk-js constants), taking
// priority over whatever this app passes as a component prop. Reusing that
// name here would mean an untrusted value could reach Clerk's own redirect
// handling before (or instead of) the validation in getSafeRedirectPath ever
// ran. return_to is app-owned and only ever read by pages/login.vue.
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

// True for a path that a browser would treat as protocol-relative (host-only,
// no scheme) if it were ever assigned to a link/navigation target — "//host"
// or the backslash variant some browsers normalize the same way.
function isProtocolRelative(path: string): boolean {
  return path.startsWith("//") || path.startsWith("/\\");
}

/**
 * Validates an untrusted return_to query value before it's ever used to
 * navigate, so a crafted /login?return_to=https://evil.com (or a
 * protocol-relative //evil.com, or a value a browser's URL parser would
 * normalize into one — a backslash variant like /\evil.com, a stripped
 * tab/newline like "/\t/evil.com", or dot-segments that collapse down to one
 * like "/.//evil.com") can't turn the sign-in flow into an open redirect.
 * Parses rawValue against a fixed placeholder origin using the same WHATWG
 * URL algorithm a browser uses, then requires the parsed origin to still
 * match that placeholder — i.e. rawValue must resolve to a same-origin path,
 * never a different host. That check alone isn't sufficient: the URL parser
 * can normalize a dotted/relative input into an *output* pathname that is
 * itself protocol-relative (e.g. "/.//evil.com" parses with the placeholder
 * origin intact, but normalizes its own pathname to "//evil.com"), so the
 * built path/search/hash is re-checked with isProtocolRelative below before
 * ever being returned. Also refuses a value that resolves back to the login
 * page itself, so a crafted return_to can't bounce a visitor straight back to
 * /login after they've just signed in.
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
  if (parsed.pathname === LOGIN_PATH) {
    return null;
  }
  const safePath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  if (isProtocolRelative(safePath)) {
    return null;
  }
  return safePath;
}
