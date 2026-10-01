import * as Sentry from "@sentry/nuxt";
import type { CspViolation } from "./cspReports";

function blockedOrigin(violation: CspViolation): string {
  if (!violation.blockedUri) {
    return "none";
  }
  try {
    return new URL(violation.blockedUri).origin;
  } catch {
    return violation.blockedUri;
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
