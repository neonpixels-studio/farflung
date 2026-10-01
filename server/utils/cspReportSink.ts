import * as Sentry from "@sentry/nuxt";
import type { CspViolation } from "./cspReports";

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
      // One issue per directive + blocked resource, not per visitor/page.
      fingerprint: ["csp-violation", directive, violation.blockedUri ?? "none"],
      extra: { ...violation },
    });
  }
}
