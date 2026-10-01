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
const NO_BLOCKED_SOURCE = "none";

// Non-special schemes (chrome-extension:, moz-extension:) report an opaque
// "null" origin, so fall back to protocol + host to keep extensions distinct.
function originOf(url: URL): string {
  return url.origin === "null" ? `${url.protocol}//${url.host}` : url.origin;
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
