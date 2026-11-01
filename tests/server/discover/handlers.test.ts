// fallow-ignore-file code-duplication

/**
 * Tests for the discover endpoint handlers:
 *   GET /api/discover/featured
 *   GET /api/discover/guides
 *   GET /api/discover/people
 *   GET /api/discover/trending
 *
 * Each handler is a thin authentication + delegation wrapper. Tests verify
 * auth scoping, query-param parsing (trending only), and delegation to the
 * query helpers in discover-queries.ts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { unwrapHandler, makeStubDatabase } from "./_helpers";
import { stubNitroGlobals } from "../test-utils";

stubNitroGlobals();
vi.stubGlobal("getQuery", vi.fn().mockReturnValue({}));

vi.mock("../../../server/utils/auth", () => ({
  requireUser: vi.fn(),
}));

vi.mock("../../../server/db/index", () => ({
  getDb: vi.fn(),
}));

vi.mock("../../../server/utils/discover-queries", () => ({
  fetchFeaturedTrips: vi.fn(),
  fetchTrendingPlaces: vi.fn(),
  fetchGuides: vi.fn(),
  fetchSuggestedPeople: vi.fn(),
}));

import { requireUser } from "../../../server/utils/auth";
import { getDb } from "../../../server/db/index";
import {
  fetchFeaturedTrips,
  fetchTrendingPlaces,
  fetchGuides,
  fetchSuggestedPeople,
} from "../../../server/utils/discover-queries";

const mockRequireUser = vi.mocked(requireUser);
const mockGetDb = vi.mocked(getDb);
const mockGetQuery = vi.mocked(
  getQuery as (event: unknown) => Record<string, unknown>,
);
const mockFetchFeaturedTrips = vi.mocked(fetchFeaturedTrips);
const mockFetchTrendingPlaces = vi.mocked(fetchTrendingPlaces);
const mockFetchGuides = vi.mocked(fetchGuides);
const mockFetchSuggestedPeople = vi.mocked(fetchSuggestedPeople);

const featuredHandler =
  await import("../../../server/api/discover/featured.get");
const trendingHandler =
  await import("../../../server/api/discover/trending.get");
const guidesHandler = await import("../../../server/api/discover/guides.get");
const peopleHandler = await import("../../../server/api/discover/people.get");

function callFeatured() {
  return unwrapHandler(featuredHandler as Record<string, unknown>)({});
}

function callTrending() {
  return unwrapHandler(trendingHandler as Record<string, unknown>)({});
}

function callGuides() {
  return unwrapHandler(guidesHandler as Record<string, unknown>)({});
}

function callPeople() {
  return unwrapHandler(peopleHandler as Record<string, unknown>)({});
}

// ---------------------------------------------------------------------------
// Shared auth guard — every handler must throw 401 when unauthenticated
// ---------------------------------------------------------------------------

function describeAuthGuard(handlerName: string, call: () => Promise<unknown>) {
  it(`${handlerName} throws 401 when not authenticated`, async () => {
    mockRequireUser.mockImplementation(() => {
      throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
    });

    await expect(call()).rejects.toMatchObject({ statusCode: 401 });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireUser.mockReturnValue("user-1");
  mockGetDb.mockReturnValue(makeStubDatabase());
  mockGetQuery.mockReturnValue({});
  mockFetchFeaturedTrips.mockResolvedValue([]);
  mockFetchTrendingPlaces.mockResolvedValue([]);
  mockFetchGuides.mockResolvedValue([]);
  mockFetchSuggestedPeople.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// GET /api/discover/featured
// ---------------------------------------------------------------------------

describe("GET /api/discover/featured", () => {
  describeAuthGuard("featured", callFeatured);

  it("returns featured trips from the query helper", async () => {
    const trips = [
      {
        id: "trip-1",
        name: "Iceland Ring Road",
        status: "past",
        stopCount: 7,
        ownerHandle: "elsa_far",
        ownerDisplayName: "Elsa",
      },
    ];
    mockFetchFeaturedTrips.mockResolvedValue(trips);

    const result = await callFeatured();

    expect(result).toEqual(trips);
  });

  it("returns an empty array when no public trips exist", async () => {
    const result = await callFeatured();
    expect(result).toEqual([]);
  });

  it("delegates to fetchFeaturedTrips with the database instance", async () => {
    const fakeDb = { select: vi.fn() } as unknown as ReturnType<typeof getDb>;
    mockGetDb.mockReturnValue(fakeDb);

    await callFeatured();

    expect(mockFetchFeaturedTrips).toHaveBeenCalledWith(fakeDb);
  });
});

// ---------------------------------------------------------------------------
// GET /api/discover/guides
// ---------------------------------------------------------------------------

describe("GET /api/discover/guides", () => {
  describeAuthGuard("guides", callGuides);

  it("returns guides from the query helper", async () => {
    const guides = [
      {
        id: "guide-1",
        title: "Cold-water swimming in Iceland",
        readTimeMinutes: 8,
        likeCount: 412,
        ownerHandle: "elsa_far",
        ownerDisplayName: "Elsa",
      },
    ];
    mockFetchGuides.mockResolvedValue(guides);

    const result = await callGuides();

    expect(result).toEqual(guides);
  });

  it("returns an empty array when no public guides exist", async () => {
    const result = await callGuides();
    expect(result).toEqual([]);
  });

  it("delegates to fetchGuides with the database instance", async () => {
    const fakeDb = { select: vi.fn() } as unknown as ReturnType<typeof getDb>;
    mockGetDb.mockReturnValue(fakeDb);

    await callGuides();

    expect(mockFetchGuides).toHaveBeenCalledWith(fakeDb);
  });
});

// ---------------------------------------------------------------------------
// GET /api/discover/people
// ---------------------------------------------------------------------------

describe("GET /api/discover/people", () => {
  describeAuthGuard("people", callPeople);

  it("returns suggested people from the query helper", async () => {
    const people = [
      {
        userId: "user-2",
        displayName: "Marco",
        handle: "marco.travels",
        homeBase: "Lisbon",
        placeCount: 84,
      },
    ];
    mockFetchSuggestedPeople.mockResolvedValue(people);

    const result = await callPeople();

    expect(result).toEqual(people);
  });

  it("passes the authenticated userId to fetchSuggestedPeople for scoping", async () => {
    mockRequireUser.mockReturnValue("user-42");

    await callPeople();

    expect(mockFetchSuggestedPeople).toHaveBeenCalledWith(
      expect.anything(),
      "user-42",
    );
  });

  it("returns an empty array when no suggestions exist", async () => {
    const result = await callPeople();
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// GET /api/discover/trending
// ---------------------------------------------------------------------------

describe("GET /api/discover/trending", () => {
  describeAuthGuard("trending", callTrending);

  it("returns trending places with no category filter", async () => {
    const places = [
      {
        name: "Reynisfjara",
        country: "Iceland",
        category: "nature",
        saveCount: 42,
        recentSaveCount: 18,
      },
    ];
    mockFetchTrendingPlaces.mockResolvedValue(places);

    const result = await callTrending();

    expect(result).toEqual(places);
    expect(mockFetchTrendingPlaces).toHaveBeenCalledWith(
      expect.anything(),
      null,
    );
  });

  it("passes the lowercased category to the query helper", async () => {
    mockGetQuery.mockReturnValue({ category: "Nature" });

    await callTrending();

    expect(mockFetchTrendingPlaces).toHaveBeenCalledWith(
      expect.anything(),
      "nature",
    );
  });

  it("passes null category when filter is 'All'", async () => {
    mockGetQuery.mockReturnValue({ category: "All" });

    await callTrending();

    expect(mockFetchTrendingPlaces).toHaveBeenCalledWith(
      expect.anything(),
      null,
    );
  });

  it("throws 400 for an unrecognised category", async () => {
    mockGetQuery.mockReturnValue({ category: "underwater" });

    await expect(callTrending()).rejects.toMatchObject({ statusCode: 400 });
  });

  it("returns an empty array when no trending places exist", async () => {
    const result = await callTrending();
    expect(result).toEqual([]);
  });
});
