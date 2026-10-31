/**
 * AES-256-GCM encryption/decryption for OAuth access tokens stored in the DB.
 *
 * The schema notes that access tokens are stored as ciphertext; this module is
 * the single place that handles encryption so call sites and tests stay clean.
 *
 * The key is read from TOKEN_ENCRYPTION_KEY (32 hex-encoded bytes = 64 chars).
 * Generate a suitable key: `openssl rand -hex 32`
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTE_LENGTH = 12;
const AUTH_TAG_BYTE_LENGTH = 16;
const EXPECTED_KEY_HEX_LENGTH = 64;

export function readEncryptionKey(): Buffer {
  const hex =
    process.env.TOKEN_ENCRYPTION_KEY || useRuntimeConfig().tokenEncryptionKey;
  if (hex.length !== EXPECTED_KEY_HEX_LENGTH) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Generate one with: openssl rand -hex 32",
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypts a plaintext token and returns a base64-encoded string in the format:
 * `<iv_hex>:<authTag_hex>:<ciphertext_base64>`.
 */
export function encryptToken(plaintext: string): string {
  const key = readEncryptionKey();
  const iv = randomBytes(IV_BYTE_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("base64"),
  ].join(":");
}

/**
 * Decrypts a token that was encrypted by `encryptToken`. Returns the plaintext.
 * Throws if the format is wrong, the auth tag fails, or the key is missing.
 */
export function decryptToken(ciphertext: string): string {
  const key = readEncryptionKey();
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid ciphertext format");
  }
  const [ivHex, authTagHex, encryptedBase64] = parts;
  const iv = Buffer.from(ivHex!, "hex");
  const authTag = Buffer.from(authTagHex!, "hex");
  const encrypted = Buffer.from(encryptedBase64!, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8",
  );
}
