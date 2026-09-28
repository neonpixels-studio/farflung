import { requireUser } from "../utils/auth";
import { runSearch, type SearchResults } from "../utils/search-queries";

const MIN_QUERY_LENGTH = 1;
const MAX_QUERY_LENGTH = 100;

const EMPTY_RESULTS: SearchResults = {
  places: [],
  trips: [],
  entries: [],
  guides: [],
  people: [],
  tags: [],
};

function isValidQuery(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  return (
    trimmed.length >= MIN_QUERY_LENGTH && trimmed.length <= MAX_QUERY_LENGTH
  );
}

export default defineEventHandler(async (event) => {
  const userId = requireUser(event);
  const query = getQuery(event);

  if (!isValidQuery(query.q)) {
    return EMPTY_RESULTS;
  }

  return runSearch(userId, query.q.trim());
});
