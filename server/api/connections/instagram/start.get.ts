/**
 * GET /api/connections/instagram/start
 *
 * Returns the Instagram OAuth authorization URL for the authenticated user as
 * `{ url }`. This needs the Clerk Bearer token, which a full-page navigation
 * can't send, so the client fetches it and then navigates (same convention as
 * the billing routes). The signed `state` in the URL carries the user, and its
 * nonce is set as a short-lived cookie that the callback checks, because the
 * callback arrives with no Authorization header (see utils/oauthState.ts).
 */

import { ensureUser } from "../../../utils/auth";
import { issueOAuthState } from "../../../utils/oauthState";
import { buildInstagramAuthUrl } from "../../../utils/instagramClient";
import { assertInstagramSyncAllowed } from "../../../utils/planLimits";

const STATE_COOKIE_NAME = "ig_oauth_state";
const STATE_COOKIE_MAX_AGE_SECONDS = 600;

function buildRedirectUri(origin: string): string {
  return `${origin}/api/connections/instagram/callback`;
}

function readInstagramConfig(): { clientId: string; redirectUri: string } {
  const config = useRuntimeConfig();
  const clientId = process.env.INSTAGRAM_CLIENT_ID || config.instagramClientId;
  const appOrigin =
    process.env.NUXT_PUBLIC_SITE_ORIGIN || config.public.siteOrigin;

  if (!clientId) {
    throw createError({
      statusCode: 500,
      statusMessage: "Instagram OAuth is not configured",
    });
  }

  if (!appOrigin) {
    throw createError({
      statusCode: 500,
      statusMessage: "NUXT_PUBLIC_SITE_ORIGIN is not configured",
    });
  }

  return { clientId, redirectUri: buildRedirectUri(appOrigin) };
}

export default defineEventHandler(async (event) => {
  const userId = await ensureUser(event);
  await assertInstagramSyncAllowed(userId);

  const { clientId, redirectUri } = readInstagramConfig();
  const { state, nonce } = issueOAuthState(userId);

  setCookie(event, STATE_COOKIE_NAME, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });

  return { url: buildInstagramAuthUrl({ clientId, redirectUri, state }) };
});
