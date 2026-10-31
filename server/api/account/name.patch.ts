import { ensureUser } from "../../utils/auth";
import { clerkUpdateName } from "../../utils/clerkAccount";
import { getDb } from "../../db/index";
import { userPreferences } from "../../db/schema";
import { requireString } from "../../utils/db-helpers";
import {
  NAME_PART_MAX_LENGTH,
  composeDisplayName,
} from "../../utils/displayName";

function parseNamePart(value: unknown, fieldName: string): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} must be a string`,
    });
  }
  const trimmed = value.trim();
  if (trimmed.length > NAME_PART_MAX_LENGTH) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} must be at most ${NAME_PART_MAX_LENGTH} characters`,
    });
  }
  return trimmed;
}

function clerkErrorMessage(error: unknown): string {
  const first = (error as { errors?: { longMessage?: string }[] })?.errors?.[0];
  return first?.longMessage ?? "Failed to update name";
}

/**
 * PATCH /api/account/name
 *
 * Clerk owns the name (the sidebar and home greeting read it), so it is saved
 * there first. `user_preferences.display_name` is then derived from it so the
 * profile, guide, search and notification readers stay in step. If the second
 * write fails the request errors and a retry is idempotent.
 */
export default defineEventHandler(async (event) => {
  const userId = await ensureUser(event);
  const body = (await readBody(event)) as Record<string, unknown> | null;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Request body must be a JSON object",
    });
  }

  requireString(body.firstName, "firstName");
  const firstName = parseNamePart(body.firstName, "firstName");
  const lastName = parseNamePart(body.lastName, "lastName");

  try {
    await clerkUpdateName(userId, {
      firstName,
      lastName: lastName === "" ? null : lastName,
    });
  } catch (error: unknown) {
    throw createError({
      statusCode: 502,
      statusMessage: clerkErrorMessage(error),
    });
  }

  const displayName = composeDisplayName(firstName, lastName);

  try {
    await getDb()
      .insert(userPreferences)
      .values({ userId, displayName })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: { displayName },
      });
  } catch (error: unknown) {
    console.error("PATCH /api/account/name: display_name sync failed", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Saved your name but could not sync it. Try again.",
    });
  }

  return { firstName, lastName, displayName };
});
