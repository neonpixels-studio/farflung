// Parses browser CSP violation reports into one normalized, size-bounded shape.
// Accepts both wire formats: legacy `report-uri` (`application/csp-report`, a
// single `{ "csp-report": {...} }` object with kebab-case keys) and the
// Reporting API (`application/reports+json`, an array of
// `{ type: "csp-violation", body: {...} }` with camelCase keys).

export const MAX_CSP_REPORT_BODY_BYTES = 16 * 1024;
export const MAX_CSP_REPORTS_PER_REQUEST = 5;
const MAX_FIELD_LENGTH = 512;
const CSP_VIOLATION_REPORT_TYPE = "csp-violation";

export interface CspViolation {
  documentUri: string | null;
  blockedUri: string | null;
  effectiveDirective: string | null;
  violatedDirective: string | null;
  disposition: string | null;
  sourceFile: string | null;
  lineNumber: number | null;
  columnNumber: number | null;
  statusCode: number | null;
}

type RawFields = Record<string, unknown>;

function isRecord(value: unknown): value is RawFields {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Reports carry the visitor's full page URL, query string included, which can
// hold tokens or PII. Drop query, fragment and credentials; keep scheme, host
// and path. Non-URL values such as "inline", "eval" or "data" pass through.
function stripUrlDetails(value: string): string {
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    url.username = "";
    url.password = "";
    return url.href;
  } catch {
    return value;
  }
}

function firstMatching<T>(
  fields: RawFields,
  keys: string[],
  isMatch: (value: unknown) => value is T,
): T | null {
  const match = keys.map((key) => fields[key]).find(isMatch);
  return match ?? null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isInteger(value: unknown): value is number {
  return Number.isInteger(value);
}

function readRawString(fields: RawFields, ...keys: string[]): string | null {
  const value = firstMatching(fields, keys, isNonEmptyString);
  return value?.slice(0, MAX_FIELD_LENGTH) ?? null;
}

function readUrl(fields: RawFields, ...keys: string[]): string | null {
  const value = readRawString(fields, ...keys);
  return value === null ? null : stripUrlDetails(value);
}

function readInteger(fields: RawFields, ...keys: string[]): number | null {
  return firstMatching(fields, keys, isInteger);
}

function normalizeViolation(fields: RawFields): CspViolation | null {
  const violation: CspViolation = {
    documentUri: readUrl(fields, "document-uri", "documentURL", "documentURI"),
    blockedUri: readUrl(fields, "blocked-uri", "blockedURL", "blockedURI"),
    effectiveDirective: readRawString(
      fields,
      "effective-directive",
      "effectiveDirective",
    ),
    violatedDirective: readRawString(
      fields,
      "violated-directive",
      "violatedDirective",
    ),
    disposition: readRawString(fields, "disposition"),
    sourceFile: readUrl(fields, "source-file", "sourceFile"),
    lineNumber: readInteger(fields, "line-number", "lineNumber"),
    columnNumber: readInteger(fields, "column-number", "columnNumber"),
    statusCode: readInteger(fields, "status-code", "statusCode"),
  };
  const hasDirective =
    violation.effectiveDirective ?? violation.violatedDirective;
  return hasDirective ? violation : null;
}

function extractRawViolations(payload: unknown): RawFields[] {
  if (Array.isArray(payload)) {
    return payload
      .filter(isRecord)
      .filter((entry) => entry.type === CSP_VIOLATION_REPORT_TYPE)
      .map((entry) => entry.body)
      .filter(isRecord);
  }
  if (isRecord(payload) && isRecord(payload["csp-report"])) {
    return [payload["csp-report"]];
  }
  return [];
}

function parseJson(rawBody: string): unknown {
  try {
    return JSON.parse(rawBody);
  } catch {
    return null;
  }
}

/** Returns the valid violations in `rawBody` (empty for malformed or unrelated input). */
export function parseCspReports(rawBody: string): CspViolation[] {
  return extractRawViolations(parseJson(rawBody))
    .slice(0, MAX_CSP_REPORTS_PER_REQUEST)
    .map(normalizeViolation)
    .filter((violation): violation is CspViolation => violation !== null);
}
