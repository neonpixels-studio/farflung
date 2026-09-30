import { ilike, eq, or, and } from "drizzle-orm";
import { getDb } from "../db/index";
import {
  places,
  trips,
  entries,
  guides,
  users,
  userPreferences,
  tags,
  entryTags,
} from "../db/schema";
import { publiclyVisibleAuthorCondition } from "./publicVisibility";
import { deriveTripStatus } from "./tripStatus";

const SEARCH_RESULT_LIMIT = 5;

export interface PlaceResult {
  id: string;
  name: string;
  subtitle: string | null;
  country: string | null;
  category: string | null;
}

export interface TripResult {
  id: string;
  name: string;
  status: string;
}

export interface EntryResult {
  id: string;
  title: string;
}

export interface GuideResult {
  id: string;
  title: string;
}

export interface PersonResult {
  id: string;
  displayName: string | null;
  handle: string | null;
}

export interface TagResult {
  id: string;
  name: string;
}

export interface SearchResults {
  places: PlaceResult[];
  trips: TripResult[];
  entries: EntryResult[];
  guides: GuideResult[];
  people: PersonResult[];
  tags: TagResult[];
}

function buildSearchPattern(query: string): string {
  // Escape any SQL LIKE special characters in the user-supplied string so the
  // ILIKE pattern is treated as a literal substring match, not a wildcard.
  const escaped = query.replace(/[%_\\]/g, "\\$&");
  return `%${escaped}%`;
}

export async function searchPlaces(
  database: ReturnType<typeof getDb>,
  userId: string,
  pattern: string,
): Promise<PlaceResult[]> {
  return database
    .select({
      id: places.id,
      name: places.name,
      subtitle: places.subtitle,
      country: places.country,
      category: places.category,
    })
    .from(places)
    .where(
      and(
        eq(places.userId, userId),
        or(ilike(places.name, pattern), ilike(places.country, pattern)),
      ),
    )
    .limit(SEARCH_RESULT_LIMIT);
}

export async function searchTrips(
  database: ReturnType<typeof getDb>,
  userId: string,
  pattern: string,
): Promise<TripResult[]> {
  const rows = await database
    .select({
      id: trips.id,
      name: trips.name,
      status: trips.status,
      // Selected only to derive the effective status below (see
      // deriveTripStatus) — never part of the returned TripResult shape, so a
      // search result never shows a stale "ongoing"/"upcoming" status for a
      // trip whose endDate has already lapsed (issue #291).
      endDate: trips.endDate,
    })
    .from(trips)
    .where(and(eq(trips.userId, userId), ilike(trips.name, pattern)))
    .limit(SEARCH_RESULT_LIMIT);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    status: deriveTripStatus(row),
  }));
}

export async function searchEntries(
  database: ReturnType<typeof getDb>,
  userId: string,
  pattern: string,
): Promise<EntryResult[]> {
  return database
    .select({
      id: entries.id,
      title: entries.title,
    })
    .from(entries)
    .where(
      and(
        eq(entries.userId, userId),
        or(ilike(entries.title, pattern), ilike(entries.body, pattern)),
      ),
    )
    .limit(SEARCH_RESULT_LIMIT);
}

export async function searchGuides(
  database: ReturnType<typeof getDb>,
  userId: string,
  pattern: string,
): Promise<GuideResult[]> {
  // Guide results are intentionally scoped to the requesting user (own guides
  // only); surfacing other users' public guides for discovery is out of scope.
  return database
    .select({
      id: guides.id,
      title: guides.title,
    })
    .from(guides)
    .where(
      and(
        eq(guides.userId, userId),
        or(ilike(guides.title, pattern), ilike(guides.body, pattern)),
      ),
    )
    .limit(SEARCH_RESULT_LIMIT);
}

export async function searchPeople(
  database: ReturnType<typeof getDb>,
  pattern: string,
): Promise<PersonResult[]> {
  // People results are public, non-deleted, effectively-entitled profiles,
  // never scoped to the requesting user so the current user can discover others.
  // publiclyVisibleAuthorCondition is the shared gate (live account + public
  // opt-in + effective entitlement); excluding soft-deleted accounts keeps a
  // result's profile link (/u/<id>) from landing on "Profile unavailable", and
  // the entitlement term drops a lapsed/paused subscriber whose stored opt-in
  // still reads true.
  return database
    .select({
      id: users.id,
      displayName: userPreferences.displayName,
      handle: userPreferences.handle,
    })
    .from(users)
    .innerJoin(userPreferences, eq(users.id, userPreferences.userId))
    .where(
      and(
        publiclyVisibleAuthorCondition(),
        or(
          ilike(userPreferences.displayName, pattern),
          ilike(userPreferences.handle, pattern),
        ),
      ),
    )
    .limit(SEARCH_RESULT_LIMIT);
}

// Tags are a global table (not user-owned), so results are scoped to the
// caller by joining through entry_tags -> entries and filtering on
// entries.userId — mirroring how searchPlaces/searchTrips/searchEntries scope
// their own user-owned tables. selectDistinct collapses the join back down to
// one row per tag even when a tag is attached to many of the user's entries.
export async function searchTags(
  database: ReturnType<typeof getDb>,
  userId: string,
  pattern: string,
): Promise<TagResult[]> {
  return database
    .selectDistinct({ id: tags.id, name: tags.name })
    .from(tags)
    .innerJoin(entryTags, eq(entryTags.tagId, tags.id))
    .innerJoin(entries, eq(entryTags.entryId, entries.id))
    .where(and(eq(entries.userId, userId), ilike(tags.name, pattern)))
    .limit(SEARCH_RESULT_LIMIT);
}

export async function runSearch(
  userId: string,
  rawQuery: string,
): Promise<SearchResults> {
  const database = getDb();
  const pattern = buildSearchPattern(rawQuery);

  const [placesRows, tripsRows, entriesRows, guidesRows, peopleRows, tagsRows] =
    await Promise.all([
      searchPlaces(database, userId, pattern),
      searchTrips(database, userId, pattern),
      searchEntries(database, userId, pattern),
      searchGuides(database, userId, pattern),
      searchPeople(database, pattern),
      searchTags(database, userId, pattern),
    ]);

  return {
    places: placesRows,
    trips: tripsRows,
    entries: entriesRows,
    guides: guidesRows,
    people: peopleRows,
    tags: tagsRows,
  };
}
