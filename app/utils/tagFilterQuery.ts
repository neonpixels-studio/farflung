// Shared contract between useSearch's mapTag (which builds the /journal?tag=…
// link for a "Tags" search result) and journal.vue (which reads the filter
// back on mount and syncs it on click). Defined once so the two sides can
// never drift on the query param names.
export const TAG_QUERY_PARAM = "tag";
export const TAG_NAME_QUERY_PARAM = "tagName";
