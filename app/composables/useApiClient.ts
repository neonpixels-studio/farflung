import { SSR_FETCH_TIMEOUT_MS } from "~/constants/ssr";
import { rejectAfterTimeout } from "~/utils/rejectAfterTimeout";

/**
 * Returns a thin $fetch wrapper that injects the Clerk session token as an
 * Authorization: Bearer header on /api/* requests.
 *
 * Usage:
 *   const { apiFetch } = useApiClient();
 *   const data = await apiFetch('/api/health');
 *
 * The token is only injected for /api/* paths. Absolute URLs, protocol-relative
 * URLs (//host/...), and non-/api/ paths do not receive the Clerk JWT so the
 * session token cannot be leaked to third parties.
 *
 * The token is resolved fresh per call so it auto-refreshes when the session
 * rotates. `getToken` is a ref containing the Clerk getToken function.
 */
export function useApiClient(
  // Defaults to the real compile-time flag. Overridable so a test can
  // exercise the server short-circuit directly: import.meta.server is fixed
  // per-module at build time by Nuxt's own macro replacement and can't be
  // toggled from a test file importing this module.
  isServer: boolean = import.meta.server,
) {
  const { getToken } = useClerkAuth();

  // useRequestFetch() (not the plain global $fetch): during SSR (#289's
  // guide/trip/profile detail pages, the first callers to actually exercise
  // apiFetch server-side — every earlier call site was client-only), a
  // relative same-origin path like /api/guides/:id must be dispatched
  // in-process against the current request's event rather than as a real
  // network round trip back to the very server that's still in the middle of
  // handling this request — which can hang. Client-side this resolves to the
  // same plain global $fetch used before (see useRequestFetch's own
  // implementation), so this is a no-op there.
  const requestFetch = useRequestFetch();

  function isApiPath(url: string): boolean {
    // Only inject the token for /api/* paths. Protocol-relative URLs like
    // //evil.com/... start with "/" but are external — restricting to /api/
    // closes that loophole and matches the documented contract.
    return url.startsWith("/api/");
  }

  async function resolveToken(): Promise<string | null> {
    // Clerk's server middleware is disabled fleet-wide (skipServerMiddleware,
    // see nuxt.config.ts), but `getToken.value` is still a real function
    // reference server-side (not falsy) — it's *calling* it that never
    // resolves there (confirmed: it hung every SSR request in #289's manual
    // testing, not just returned null slowly), since Clerk has no server
    // context to resolve a token against. Every server-side apiFetch call is
    // anonymous by construction; short-circuit before ever invoking it.
    if (isServer) {
      return null;
    }
    if (!getToken.value) {
      return null;
    }
    return getToken.value();
  }

  function buildHeaders(
    existingHeaders: HeadersInit | undefined,
    token: string | null,
  ): Headers {
    // Normalize via the Headers constructor, which handles record, Headers
    // instance, and string[][] shapes without losing any caller-supplied headers.
    const headers = new Headers(existingHeaders);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return headers;
  }

  // A caller may only tighten the SSR bound; 0, negatives and non-numbers
  // fall back to the default (ofetch reads 0 as "no timeout").
  function resolveSsrTimeout(callerTimeout: unknown): number {
    if (typeof callerTimeout !== "number" || callerTimeout <= 0) {
      return SSR_FETCH_TIMEOUT_MS;
    }
    return Math.min(callerTimeout, SSR_FETCH_TIMEOUT_MS);
  }

  async function apiFetch<T>(
    url: string,
    options: Parameters<typeof $fetch>[1] = {},
  ): Promise<T> {
    const token = isApiPath(url) ? await resolveToken() : null;
    const headers = buildHeaders(
      options.headers as HeadersInit | undefined,
      token,
    );
    if (!isServer) {
      return requestFetch<T>(url, { ...options, headers });
    }
    // Bound every SSR call so a slow/hung backend can't hang the whole page
    // response. `timeout` is ofetch's native option (covers real network
    // fetches); the race covers the in-process dispatch, which ignores it. A
    // caller may only tighten the bound, never lift it.
    const ssrTimeoutMs = resolveSsrTimeout(options.timeout);
    return rejectAfterTimeout(
      // retry: 0 by default — ofetch retries timed-out GETs, which would fire
      // a second request at a backend that's already too slow, after the race
      // has already given up on the first.
      requestFetch<T>(url, {
        ...options,
        retry: options.retry ?? 0,
        timeout: ssrTimeoutMs,
        headers,
      }),
      ssrTimeoutMs,
    );
  }

  return { apiFetch };
}
