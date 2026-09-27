export const AUTH_REDIRECT_QUERY_PARAM = "redirect_url";

const LOGIN_PATH = "/login";

/**
 * Builds a /login path that carries the current location as a redirect-back
 * query param, so an authenticating visitor lands back on what they clicked
 * from instead of the default post-login destination (#292). Used by every
 * "sign in to ..." link across profile/trips/guides.
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
 * Validates an untrusted redirect_url query value before it's ever used to
 * navigate, so a crafted /login?redirect_url=https://evil.com (or a
 * protocol-relative //evil.com, or a browser-normalized backslash variant
 * like /\evil.com) can't turn the sign-in flow into an open redirect. Only a
 * same-origin, root-relative path is accepted; anything else returns null.
 */
export function getSafeRedirectPath(rawValue: unknown): string | null {
  if (typeof rawValue !== "string" || rawValue.length === 0) {
    return null;
  }
  const isRootRelative = rawValue.startsWith("/");
  const isProtocolRelative =
    rawValue.startsWith("//") || rawValue.startsWith("/\\");
  if (!isRootRelative || isProtocolRelative) {
    return null;
  }
  return rawValue;
}
