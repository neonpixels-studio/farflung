import { and, eq, isNull, ne, sql } from "drizzle-orm";
import type { getDb } from "../db/index";
import { userPreferences, users } from "../db/schema";

type Database = ReturnType<typeof getDb>;

/**
 * The user id that owns `handle`, matched case-insensitively (the same
 * lower(handle) expression the unique index covers). Soft-deleted accounts are
 * treated as unowned. Visibility is NOT checked here: callers serving a public
 * page must follow up with requireViewableProfile.
 */
export async function findUserIdByHandle(
  database: Database,
  handle: string,
): Promise<string | null> {
  const rows = await database
    .select({ userId: userPreferences.userId })
    .from(userPreferences)
    .innerJoin(users, eq(users.id, userPreferences.userId))
    .where(
      and(
        sql`lower(${userPreferences.handle}) = lower(${handle})`,
        isNull(users.deletedAt),
      ),
    )
    .limit(1);
  return rows[0]?.userId ?? null;
}

/** True when another user already holds `handle` (case-insensitive). */
export async function isHandleTaken(
  database: Database,
  handle: string,
  exceptUserId: string,
): Promise<boolean> {
  const rows = await database
    .select({ userId: userPreferences.userId })
    .from(userPreferences)
    .where(
      and(
        sql`lower(${userPreferences.handle}) = lower(${handle})`,
        ne(userPreferences.userId, exceptUserId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
