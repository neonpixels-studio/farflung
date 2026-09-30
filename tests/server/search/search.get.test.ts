import { describe, it, expect, vi, beforeEach } from "vitest";
import { stubNitroGlobals } from "../test-utils";

stubNitroGlobals();
vi.stubGlobal("getQuery", vi.fn().mockReturnValue({}));

vi.mock("../../../server/utils/auth", () => ({
  requireUser: vi.fn(),
}));

vi.mock("../../../server/utils/search-queries", () => ({
  runSearch: vi.fn(),
}));

import { requireUser } from "../../../server/utils/auth";
import { runSearch } from "../../../server/utils/search-queries";

const mockRequireUser = vi.mocked(requireUser);
const mockRunSearch = vi.mocked(runSearch);
const mockGetQuery = vi.mocked(
  globalThis.getQuery as (event: unknown) => Record<string, unknown>,
);

const EMPTY_RESULTS = {
  places: [],
  trips: [],
  entries: [],
  guides: [],
  people: [],
  tags: [],
};

const handler = await import("../../../server/api/search.get");

function callHandler() {
  const defaultHandler = "default" in handler ? handler.default : handler;
  return (defaultHandler as (event: unknown) => unknown)({});
}

describe("GET /api/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetQuery.mockReturnValue({});
    mockRequireUser.mockReturnValue("user-1");
    mockRunSearch.mockResolvedValue(EMPTY_RESULTS);
  });

  it("throws 401 when not authenticated", async () => {
    mockRequireUser.mockImplementation(() => {
      throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
    });

    await expect(callHandler()).rejects.toMatchObject({ statusCode: 401 });
  });

  it("returns empty groups when q is missing", async () => {
    mockGetQuery.mockReturnValue({});

    const result = await callHandler();

    expect(result).toEqual(EMPTY_RESULTS);
    expect(mockRunSearch).not.toHaveBeenCalled();
  });

  it("returns empty groups when q is an empty string", async () => {
    mockGetQuery.mockReturnValue({ q: "" });

    const result = await callHandler();

    expect(result).toEqual(EMPTY_RESULTS);
    expect(mockRunSearch).not.toHaveBeenCalled();
  });

  it("returns empty groups when q is only whitespace", async () => {
    mockGetQuery.mockReturnValue({ q: "   " });

    const result = await callHandler();

    expect(result).toEqual(EMPTY_RESULTS);
    expect(mockRunSearch).not.toHaveBeenCalled();
  });

  it("calls runSearch with the authenticated userId and trimmed query", async () => {
    const searchResults = {
      places: [
        {
          id: "p-1",
          name: "Reykjavík",
          subtitle: null,
          country: "Iceland",
          category: null,
        },
      ],
      trips: [],
      entries: [],
      people: [],
    };
    mockGetQuery.mockReturnValue({ q: "  reyk  " });
    mockRunSearch.mockResolvedValue(searchResults);

    const result = await callHandler();

    expect(mockRunSearch).toHaveBeenCalledWith("user-1", "reyk");
    expect(result).toEqual(searchResults);
  });

  it("returns all six groups in the response shape", async () => {
    const searchResults = {
      places: [
        {
          id: "p-1",
          name: "Tokyo",
          subtitle: null,
          country: "Japan",
          category: "city",
        },
      ],
      trips: [{ id: "t-1", name: "Japan 2025", status: "past" }],
      entries: [{ id: "e-1", title: "Shinjuku station" }],
      guides: [{ id: "g-1", title: "48 hours in Kyoto" }],
      people: [
        {
          id: "u-2",
          displayName: "Yuki",
          handle: "yuki",
        },
      ],
      tags: [{ id: "tag-1", name: "ramen" }],
    };
    mockGetQuery.mockReturnValue({ q: "japan" });
    mockRunSearch.mockResolvedValue(searchResults);

    const result = (await callHandler()) as typeof searchResults;

    expect(result.places).toHaveLength(1);
    expect(result.trips).toHaveLength(1);
    expect(result.entries).toHaveLength(1);
    expect(result.guides).toHaveLength(1);
    expect(result.people).toHaveLength(1);
    expect(result.tags).toHaveLength(1);
  });

  it("scopes results to the authenticated user by passing userId to runSearch", async () => {
    mockRequireUser.mockReturnValue("user-42");
    mockGetQuery.mockReturnValue({ q: "tokyo" });
    mockRunSearch.mockResolvedValue(EMPTY_RESULTS);

    await callHandler();

    expect(mockRunSearch).toHaveBeenCalledWith("user-42", "tokyo");
  });

  it("returns empty groups when q exceeds the maximum query length", async () => {
    const oversizedQuery = "a".repeat(101);
    mockGetQuery.mockReturnValue({ q: oversizedQuery });

    const result = await callHandler();

    expect(result).toEqual(EMPTY_RESULTS);
    expect(mockRunSearch).not.toHaveBeenCalled();
  });

  it("accepts a query exactly at the maximum allowed length", async () => {
    const maxLengthQuery = "a".repeat(100);
    mockGetQuery.mockReturnValue({ q: maxLengthQuery });
    mockRunSearch.mockResolvedValue(EMPTY_RESULTS);

    await callHandler();

    expect(mockRunSearch).toHaveBeenCalledWith("user-1", maxLengthQuery);
  });
});
