// Parses browser CSP violation reports into one normalized, size-bounded shape.
// Accepts both wire formats: legacy `report-uri` (`application/csp-report`, a
// single `{ "csp-report": {...} }` object with kebab-case keys) and the
// Reporting API (`application/reports+json`, an array of
// `{ type: "csp-violation", body: {...} }` with camelCase keys).

export const MAX_CSP_REPORT_BODY_BYTES = 16 * 1024;
export const MAX_CSP_REPORTS_PER_REQUEST = 20;
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
// hold tokens or PII. Keep only origin + path for URLs; non-URL values such as
// "inline", "eval" or "data" pass through as-is.
function stripUrlDetails(value: string): string {
  try {
    const url = new URL(value);
    return `${url.origin === "null" ? `${url.protocol}` : url.origin}${url.pathname}`;
  } catch {
    return value;
  }
}

function readString(fields: RawFields, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = fields[key];
    if (typeof value === "string" && value.length > 0) {
      return stripUrlDetails(value.slice(0, MAX_FIELD_LENGTH));
    }
  }
  return null;
}

function readDirective(fields: RawFields, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = fields[key];
    if (typeof value === "string" && value.length > 0) {
      return value.slice(0, MAX_FIELD_LENGTH);
    }
  }
  return null;
}

function readInteger(fields: RawFields, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = fields[key];
    if (Number.isInteger(value)) {
      return value as number;
    }
  }
  return null;
}

function normalizeViolation(fields: RawFields): CspViolation | null {
  const violation: CspViolation = {
    documentUri: readString(
      fields,
      "document-uri",
      "documentURL",
      "documentURI",
    ),
    blockedUri: readString(fields, "blocked-uri", "blockedURL", "blockedURI"),
    effectiveDirective: readDirective(
      fields,
      "effective-directive",
      "effectiveDirective",
    ),
    violatedDirective: readDirective(
      fields,
      "violated-directive",
      "violatedDirective",
    ),
    disposition: readDirective(fields, "disposition"),
    sourceFile: readString(fields, "source-file", "sourceFile"),
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
