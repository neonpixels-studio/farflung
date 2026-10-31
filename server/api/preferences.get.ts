import { eq } from "drizzle-orm";
import { ensureUser } from "../utils/auth";
import { getDb } from "../db/index";
import { userPreferences, DISTANCE_UNIT } from "../db/schema";
import { type PreferencesDto, rowToDto } from "./preferences.patch";

const PREFERENCES_DTO_DEFAULTS: PreferencesDto = {
  distanceUnit: DISTANCE_UNIT.MI,
  defaultMapStyle: null,
  theme: null,
  accentColor: null,
  publicProfile: false,
  preciseLocation: false,
  showOnExplore: true,
  displayName: null,
  handle: null,
  homeBase: null,
  bio: null,
};

export default defineEventHandler(async (event) => {
  const userId = await ensureUser(event);
  const database = getDb();

  const rows = await database
    .select({
      distanceUnit: userPreferences.distanceUnit,
      defaultMapStyle: userPreferences.defaultMapStyle,
      theme: userPreferences.theme,
      accentColor: userPreferences.accentColor,
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

  if (rows.length === 0) {
    return PREFERENCES_DTO_DEFAULTS;
  }

  return rowToDto(rows[0] as unknown as Record<string, unknown>);
});
