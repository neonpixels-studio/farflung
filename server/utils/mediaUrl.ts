/**
 * Signed media URLs. Plain <img> tags and social crawlers can't send a Bearer
 * token, so the API hands out URLs carrying a time-limited signature instead.
 * A URL is only issued after the caller passes the read check for whatever owns
 * the photo, so the signature is what stands between a private photo and anyone
 * who guesses or keeps its id.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { requireClerkSecretKey } from "./clerk";

const SECONDS_PER_DAY = 86_400;
const MEDIA_URL_LIFETIME_DAYS = 7;
const SIGNING_KEY_LABEL = "farflung:media-url-signing";

export type MediaVariant = "original" | "thumbnail";

// Derived rather than a new secret: every environment already has this key, and
// rotating it only expires URLs, which the next API read reissues.
function signingKey(): Buffer {
  return createHmac("sha256", requireClerkSecretKey())
    .update(SIGNING_KEY_LABEL)
    .digest();
}

function computeSignature(
  mediaId: string,
  variant: MediaVariant,
  expiresAt: number,
): string {
  return createHmac("sha256", signingKey())
    .update(`${mediaId}:${variant}:${expiresAt}`)
    .digest("base64url");
}

// Rounded up to a day boundary so repeat reads return the same URL and the
// browser cache keeps working.
function nextExpiry(nowSeconds: number): number {
  const earliest = nowSeconds + MEDIA_URL_LIFETIME_DAYS * SECONDS_PER_DAY;
  return Math.ceil(earliest / SECONDS_PER_DAY) * SECONDS_PER_DAY;
}

export function buildSignedMediaPath(
  mediaId: string,
  variant: MediaVariant = "original",
  nowSeconds: number = Math.floor(Date.now() / 1000),
): string {
  const expiresAt = nextExpiry(nowSeconds);
  const signature = computeSignature(mediaId, variant, expiresAt);
  const suffix = variant === "thumbnail" ? "/thumbnail" : "";
  return `/api/media/${mediaId}${suffix}?exp=${expiresAt}&sig=${signature}`;
}

function signaturesMatch(provided: string, expected: string): boolean {
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  if (providedBytes.length !== expectedBytes.length) {
    return false;
  }
  return timingSafeEqual(providedBytes, expectedBytes);
}

/** Returns the seconds left on a valid signature, or null if it isn't valid. */
export function verifyMediaSignature(
  mediaId: string,
  variant: MediaVariant,
  query: { exp?: unknown; sig?: unknown },
  nowSeconds: number = Math.floor(Date.now() / 1000),
): number | null {
  const expiresAt = Number(query.exp);
  if (typeof query.sig !== "string" || !Number.isInteger(expiresAt)) {
    return null;
  }
  if (expiresAt <= nowSeconds) {
    return null;
  }
  const expected = computeSignature(mediaId, variant, expiresAt);
  if (!signaturesMatch(query.sig, expected)) {
    return null;
  }
  return expiresAt - nowSeconds;
}
