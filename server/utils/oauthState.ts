/**
 * Signed OAuth `state` for flows whose callback arrives as a plain browser
 * redirect, with no Authorization header (see Instagram's callback).
 *
 * `state` carries the user id the flow was started for, a random nonce and an
 * expiry, signed with HMAC-SHA256. The nonce is also set as an httpOnly cookie
 * in the browser that started the flow, and the callback requires both to match.
 * That binds the callback to the original browser, which is what stops login
 * CSRF: an attacker can hand a victim a link carrying the attacker's own valid
 * code and signed state, but cannot set the victim's cookie, so the victim's
 * browser fails the nonce check and the attacker's Instagram account is never
 * attached to the victim's FarFlung user.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { readEncryptionKey } from "./tokenCrypto";

export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

const SIGNING_KEY_LABEL = "farflung:oauth-state:v1";
const NONCE_BYTE_LENGTH = 16;
const SEPARATOR = ".";

interface OAuthStatePayload {
  userId: string;
  nonce: string;
  expiresAt: number;
}

export interface IssuedOAuthState {
  state: string;
  nonce: string;
}

// Domain-separated from the AES use of the same key so a signature can never
// be confused with token ciphertext.
function signingKey(): Buffer {
  return createHmac("sha256", readEncryptionKey())
    .update(SIGNING_KEY_LABEL)
    .digest();
}

function sign(encodedPayload: string): Buffer {
  return createHmac("sha256", signingKey()).update(encodedPayload).digest();
}

function safeEqual(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}

export function issueOAuthState(
  userId: string,
  now: number = Date.now(),
): IssuedOAuthState {
  const nonce = randomBytes(NONCE_BYTE_LENGTH).toString("hex");
  const payload: OAuthStatePayload = {
    userId,
    nonce,
    expiresAt: now + OAUTH_STATE_TTL_MS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  const signature = sign(encodedPayload).toString("base64url");
  return { state: `${encodedPayload}${SEPARATOR}${signature}`, nonce };
}

function parsePayload(encodedPayload: string): OAuthStatePayload | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<OAuthStatePayload>;
    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.nonce !== "string" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }
    return parsed as OAuthStatePayload;
  } catch {
    return null;
  }
}

/**
 * Returns the user id the state was issued for, or null when the state is
 * malformed, tampered with, expired, or not bound to `cookieNonce`.
 */
export function verifyOAuthState(
  state: string | undefined,
  cookieNonce: string | undefined,
  now: number = Date.now(),
): string | null {
  if (!state || !cookieNonce) {
    return null;
  }
  const [encodedPayload, encodedSignature, ...rest] = state.split(SEPARATOR);
  if (!encodedPayload || !encodedSignature || rest.length > 0) {
    return null;
  }

  const providedSignature = Buffer.from(encodedSignature, "base64url");
  if (!safeEqual(providedSignature, sign(encodedPayload))) {
    return null;
  }

  const payload = parsePayload(encodedPayload);
  if (!payload || payload.expiresAt < now) {
    return null;
  }
  if (!safeEqual(Buffer.from(payload.nonce), Buffer.from(cookieNonce))) {
    return null;
  }
  return payload.userId;
}
