/**
 * Personal API keys: generation, hashing, and the queries behind both the auth
 * middleware and the /api/api-keys routes. Raw keys only ever exist in the
 * creation response and in the caller's Authorization header.
 */
import { createHash, randomBytes } from "node:crypto";
import { and, count, desc, eq, gt, isNull, lt, or } from "drizzle-orm";
import { getDb } from "../db/index";
import { apiKeys, users } from "../db/schema";
import { generateId } from "./ids";

const API_KEY_MARKER = "ff_";
const API_KEY_RANDOM_BYTES = 32;
const API_KEY_PREFIX_LENGTH = 8;
const LAST_USED_THROTTLE_MS = 60_000;

export const MAX_ACTIVE_API_KEYS = 5;

export interface ActiveApiKey {
  id: string;
  userId: string;
  lastUsedAt: Date | null;
}

export interface GeneratedApiKey {
  key: string;
  prefix: string;
  keyHash: string;
}

interface NewApiKeyInput {
  userId: string;
  name: string;
  expiresAt: Date | null;
}

export function isApiKeyToken(token: string): boolean {
  return token.startsWith(API_KEY_MARKER);
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(): GeneratedApiKey {
  const secret = randomBytes(API_KEY_RANDOM_BYTES).toString("base64url");
  const key = `${API_KEY_MARKER}${secret}`;
  return {
    key,
    prefix: secret.slice(0, API_KEY_PREFIX_LENGTH),
    keyHash: hashApiKey(key),
  };
}

function isActiveApiKey(now: Date) {
  return and(
    isNull(apiKeys.revokedAt),
    or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, now)),
  );
}

// The join on users matters: deleting an account soft-deletes the row and only
// purges it (cascading to keys) after the grace period. A Clerk session can't
// outlive the deletion, so a key must not either.
export async function findActiveApiKey(
  key: string,
): Promise<ActiveApiKey | null> {
  const rows = await getDb()
    .select({
      id: apiKeys.id,
      userId: apiKeys.userId,
      lastUsedAt: apiKeys.lastUsedAt,
    })
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.userId, users.id))
    .where(
      and(
        eq(apiKeys.keyHash, hashApiKey(key)),
        isActiveApiKey(new Date()),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

// Writes at most once per minute per key. The timestamp check is repeated in the
// WHERE so concurrent requests carrying the same stale value still write once.
// A failure is logged, not thrown: bookkeeping must not fail an authenticated
// request.
export async function recordApiKeyUse(
  apiKey: ActiveApiKey,
  now: Date = new Date(),
): Promise<void> {
  const threshold = new Date(now.getTime() - LAST_USED_THROTTLE_MS);
  if (apiKey.lastUsedAt && apiKey.lastUsedAt >= threshold) {
    return;
  }

  try {
    await getDb()
      .update(apiKeys)
      .set({ lastUsedAt: now })
      .where(
        and(
          eq(apiKeys.id, apiKey.id),
          or(isNull(apiKeys.lastUsedAt), lt(apiKeys.lastUsedAt, threshold)),
        ),
      );
  } catch (error) {
    console.error(`recordApiKeyUse: update failed for ${apiKey.id}`, error);
  }
}

export async function countActiveApiKeys(userId: string): Promise<number> {
  const rows = await getDb()
    .select({ total: count() })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), isActiveApiKey(new Date())));
  return rows[0]?.total ?? 0;
}

export async function insertApiKey(input: NewApiKeyInput) {
  const generated = generateApiKey();
  const rows = await getDb()
    .insert(apiKeys)
    .values({
      id: generateId(),
      userId: input.userId,
      name: input.name,
      prefix: generated.prefix,
      keyHash: generated.keyHash,
      expiresAt: input.expiresAt,
    })
    .returning({
      id: apiKeys.id,
      name: apiKeys.name,
      prefix: apiKeys.prefix,
      createdAt: apiKeys.createdAt,
      expiresAt: apiKeys.expiresAt,
    });

  const inserted = rows[0];
  if (!inserted) {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to create API key",
    });
  }
  return { ...inserted, key: generated.key };
}

export function listApiKeys(userId: string) {
  return getDb()
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      prefix: apiKeys.prefix,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
    .orderBy(desc(apiKeys.createdAt));
}

// Returns false when no un-revoked key with this id belongs to the user.
export async function revokeApiKey(
  userId: string,
  apiKeyId: string,
): Promise<boolean> {
  const rows = await getDb()
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(apiKeys.id, apiKeyId),
        eq(apiKeys.userId, userId),
        isNull(apiKeys.revokedAt),
      ),
    )
    .returning({ id: apiKeys.id });
  return rows.length > 0;
}
