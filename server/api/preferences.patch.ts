import { eq } from "drizzle-orm";
import { ensureUser } from "../utils/auth";
import { getDb } from "../db/index";
import { userPreferences, DISTANCE_UNIT } from "../db/schema";
import { optionalString } from "../utils/db-helpers";
import { describeHandleProblem, findHandleProblem } from "../utils/handle";
import {
  MAP_STYLES,
  assertMapStyleAllowed,
  assertPublicProfileAllowed,
} from "../utils/planLimits";

const VALID_MAP_STYLES = MAP_STYLES;

type ValidMapStyle = (typeof VALID_MAP_STYLES)[number];

// displayName is not writable here: it is derived from Clerk's first + last
// name by PATCH /api/account/name so every reader stays in step with Clerk.
// handle has its own format rules (see validateHandle).
const STRING_FIELD_MAX_LENGTHS: Record<string, number> = {
  homeBase: 100,
  bio: 500,
};

export type PreferencesDto = {
  distanceUnit: string;
  defaultMapStyle: string | null;
  publicProfile: boolean;
  preciseLocation: boolean;
  showOnExplore: boolean;
  displayName: string | null;
  handle: string | null;
  homeBase: string | null;
  bio: string | null;
};

function isValidMapStyle(value: unknown): value is ValidMapStyle {
  return (
    typeof value === "string" &&
    VALID_MAP_STYLES.includes(value as ValidMapStyle)
  );
}

function isValidDistanceUnit(
  value: unknown,
): value is (typeof DISTANCE_UNIT)[keyof typeof DISTANCE_UNIT] {
  return value === DISTANCE_UNIT.MI || value === DISTANCE_UNIT.KM;
}

function isOptionalBoolean(value: unknown): value is boolean | undefined {
  return value === undefined || value === null || typeof value === "boolean";
}

type PatchResult = {
  distanceUnit?: (typeof DISTANCE_UNIT)[keyof typeof DISTANCE_UNIT];
  defaultMapStyle?: ValidMapStyle;
  publicProfile?: boolean;
  preciseLocation?: boolean;
  showOnExplore?: boolean;
  handle?: string | null;
  homeBase?: string | null;
  bio?: string | null;
};

function validateDistanceUnit(
  body: Record<string, unknown>,
  patch: PatchResult,
): void {
  if (body.distanceUnit === undefined) {
    return;
  }
  if (!isValidDistanceUnit(body.distanceUnit)) {
    throw createError({
      statusCode: 400,
      statusMessage: `distanceUnit must be "mi" or "km"`,
    });
  }
  patch.distanceUnit = body.distanceUnit;
}

function validateMapStyle(
  body: Record<string, unknown>,
  patch: PatchResult,
): void {
  if (body.defaultMapStyle === undefined) {
    return;
  }
  if (!isValidMapStyle(body.defaultMapStyle)) {
    throw createError({
      statusCode: 400,
      statusMessage: `defaultMapStyle must be one of: ${VALID_MAP_STYLES.join(", ")}`,
    });
  }
  patch.defaultMapStyle = body.defaultMapStyle;
}

function validateBooleanFields(
  body: Record<string, unknown>,
  patch: PatchResult,
): void {
  const booleanFields = [
    "publicProfile",
    "preciseLocation",
    "showOnExplore",
  ] as const;

  for (const field of booleanFields) {
    if (body[field] === undefined) {
      continue;
    }
    if (!isOptionalBoolean(body[field])) {
      throw createError({
        statusCode: 400,
        statusMessage: `${field} must be a boolean`,
      });
    }
    if (body[field] === null) {
      continue;
    }
    patch[field] = body[field] as boolean;
  }
}

function validateStringFields(
  body: Record<string, unknown>,
  patch: PatchResult,
): void {
  const stringFields = ["homeBase", "bio"] as const;

  for (const field of stringFields) {
    if (body[field] === undefined) {
      continue;
    }
    if (body[field] === null) {
      patch[field] = null;
      continue;
    }
    const value = optionalString(body[field], field);
    if (value === undefined) {
      continue;
    }
    const maxLength = STRING_FIELD_MAX_LENGTHS[field];
    if (maxLength !== undefined && value.length > maxLength) {
      throw createError({
        statusCode: 400,
        statusMessage: `${field} must be at most ${maxLength} characters`,
      });
    }
    patch[field] = value;
  }
}

function validateHandle(
  body: Record<string, unknown>,
  patch: PatchResult,
): void {
  if (body.handle === undefined) {
    return;
  }
  if (body.handle === null) {
    patch.handle = null;
    return;
  }
  const value = optionalString(body.handle, "handle")?.trim();
  if (value === undefined || value === "") {
    patch.handle = null;
    return;
  }
  const problem = findHandleProblem(value);
  if (problem) {
    throw createError({
      statusCode: 400,
      statusMessage: describeHandleProblem(problem),
    });
  }
  patch.handle = value;
}

function validatePatch(body: Record<string, unknown>): PatchResult {
  const patch: PatchResult = {};
  validateDistanceUnit(body, patch);
  validateMapStyle(body, patch);
  validateBooleanFields(body, patch);
  validateStringFields(body, patch);
  validateHandle(body, patch);
  return patch;
}

export function rowToDto(row: Record<string, unknown>): PreferencesDto {
  return {
    distanceUnit: row.distanceUnit as string,
    defaultMapStyle: (row.defaultMapStyle as string | null) ?? null,
    publicProfile: row.publicProfile as boolean,
    preciseLocation: row.preciseLocation as boolean,
    showOnExplore: row.showOnExplore as boolean,
    displayName: (row.displayName as string | null) ?? null,
    handle: (row.handle as string | null) ?? null,
    homeBase: (row.homeBase as string | null) ?? null,
    bio: (row.bio as string | null) ?? null,
  };
}

// Drizzle wraps driver errors in DrizzleQueryError, leaving the code on `cause`.
function isPostgresUniqueError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const { code, cause } = error as {
    code?: string;
    cause?: { code?: string };
  };
  return (cause?.code ?? code) === "23505";
}

export default defineEventHandler(async (event) => {
  const userId = await ensureUser(event);
  const body = (await readBody(event)) as Record<string, unknown>;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Request body must be a JSON object",
    });
  }

  const patch = validatePatch(body);

  if (Object.keys(patch).length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "No valid fields to update",
    });
  }

  if (patch.defaultMapStyle !== undefined) {
    await assertMapStyleAllowed(userId, patch.defaultMapStyle);
  }
  if (patch.publicProfile !== undefined) {
    await assertPublicProfileAllowed(userId, patch.publicProfile);
  }

  const database = getDb();

  try {
    await database
      .insert(userPreferences)
      .values({ userId, ...patch })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: patch,
      });
  } catch (error: unknown) {
    if (isPostgresUniqueError(error) && patch.handle !== undefined) {
      throw createError({
        statusCode: 409,
        statusMessage: "handle is already taken",
      });
    }
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to save preferences",
    });
  }

  const rows = await database
    .select({
      distanceUnit: userPreferences.distanceUnit,
      defaultMapStyle: userPreferences.defaultMapStyle,
      publicProfile: userPreferences.publicProfile,
      preciseLocation: userPreferences.preciseLocation,
      showOnExplore: userPreferences.showOnExplore,
      displayName: userPreferences.displayName,
      handle: userPreferences.handle,
      homeBase: userPreferences.homeBase,
      bio: userPreferences.bio,
    })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to retrieve updated preferences",
    });
  }

  return rowToDto(row as unknown as Record<string, unknown>);
});
