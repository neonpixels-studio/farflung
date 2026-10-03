import * as Sentry from "@sentry/nuxt";
import type { CspViolation } from "./cspReports";

const CSP_KEYWORD_SOURCES = new Set([
  "inline",
  "eval",
  "wasm-eval",
  "data",
  "blob",
  "trusted-types-policy",
  "trusted-types-sink",
]);
const UNRECOGNIZED_SOURCE = "other";
const ORIGIN_SCHEMES = new Set(["http:", "https:"]);
const BUCKETED_SCHEMES = new Set([
  "chrome-extension:",
  "moz-extension:",
  "safari-web-extension:",
  "data:",
  "blob:",
]);
const NO_BLOCKED_SOURCE = "none";

// Web origins keep their host for triage. Extension and data/blob schemes
// bucket by scheme alone, and any other scheme is "other", so attacker-chosen
// schemes can't mint distinct Sentry issues.
function originOf(url: URL): string {
  if (ORIGIN_SCHEMES.has(url.protocol)) {
    return url.origin;
  }
  return BUCKETED_SCHEMES.has(url.protocol)
    ? url.protocol
    : UNRECOGNIZED_SOURCE;
}

// Bounded-cardinality grouping key: unparseable values collapse to a fixed
// allowlist or "other" so attacker-chosen strings can't mint Sentry issues.
function blockedOrigin(violation: CspViolation): string {
  if (!violation.blockedUri) {
    return NO_BLOCKED_SOURCE;
  }
  try {
    return originOf(new URL(violation.blockedUri));
  } catch {
    return CSP_KEYWORD_SOURCES.has(violation.blockedUri)
      ? violation.blockedUri
      : UNRECOGNIZED_SOURCE;
  }
}

// Isolates the Sentry dependency so the route is testable without it.
export function reportCspViolations(violations: CspViolation[]): void {
  for (const violation of violations) {
    const directive =
      violation.effectiveDirective ?? violation.violatedDirective ?? "unknown";
    Sentry.captureMessage(`CSP violation: ${directive}`, {
      level: "warning",
      tags: {
        csp_directive: directive,
        csp_disposition: violation.disposition ?? "unknown",
      },
      // One issue per directive + blocked origin. Keyed on origin, not full
      // URL, since the report body is attacker-controlled and path variations
      // would otherwise mint unlimited new Sentry issues.
      fingerprint: ["csp-violation", directive, blockedOrigin(violation)],
      extra: { ...violation },
    });
  }
}
