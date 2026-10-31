import { getDb } from "../../db/index";
import { optionalUser } from "../../utils/auth";
import { requireRouterParam } from "../../utils/db-helpers";
import { findUserIdByHandle } from "../../utils/handle-queries";
import { requireViewableProfile } from "../../utils/profile-queries";

/**
 * GET /api/handles/<handle>
 *
 * Resolves a public `/@handle` to its profile. Auth is optional (see
 * server/middleware/auth.ts) so a shared link opens for anonymous visitors.
 * An unknown handle and a private profile return the same 404 from
 * requireViewableProfile, the rule every profile endpoint shares, so the route
 * can't be used to probe which handles belong to private accounts.
 */
export default defineEventHandler(async (event) => {
  const currentUserId = optionalUser(event);
  const handle = requireRouterParam(event, "handle");
  const database = getDb();

  const targetUserId = await findUserIdByHandle(database, handle);
  if (!targetUserId) {
    throw createError({ statusCode: 404, statusMessage: "Profile not found" });
  }

  const profile = await requireViewableProfile(
    database,
    currentUserId,
    targetUserId,
  );

  return { ...profile, isSelf: currentUserId === targetUserId };
});
