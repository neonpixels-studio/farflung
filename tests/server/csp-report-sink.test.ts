import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCaptureMessage } = vi.hoisted(() => ({
  mockCaptureMessage: vi.fn(),
}));
vi.mock("@sentry/nuxt", () => ({ captureMessage: mockCaptureMessage }));

import { reportCspViolations } from "../../server/utils/cspReportSink";
import type { CspViolation } from "../../server/utils/cspReports";

function buildViolation(overrides: Partial<CspViolation>): CspViolation {
  return {
    documentUri: "https://farflung.app/",
    blockedUri: "https://evil.example/a.js",
    effectiveDirective: "script-src-elem",
    violatedDirective: "script-src",
    disposition: "report",
    sourceFile: null,
    lineNumber: null,
    columnNumber: null,
    statusCode: null,
    ...overrides,
  };
}

describe("reportCspViolations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends one grouped warning per violation", () => {
    reportCspViolations([buildViolation({}), buildViolation({})]);
    expect(mockCaptureMessage).toHaveBeenCalledTimes(2);
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      "CSP violation: script-src-elem",
      expect.objectContaining({
        level: "warning",
        tags: {
          csp_directive: "script-src-elem",
          csp_disposition: "report",
        },
        fingerprint: [
          "csp-violation",
          "script-src-elem",
          "https://evil.example",
        ],
      }),
    );
  });

  it("falls back to violatedDirective, then unknown", () => {
    reportCspViolations([
      buildViolation({ effectiveDirective: null }),
      buildViolation({ effectiveDirective: null, violatedDirective: null }),
    ]);
    expect(mockCaptureMessage.mock.calls[0][0]).toBe(
      "CSP violation: script-src",
    );
    expect(mockCaptureMessage.mock.calls[1][0]).toBe("CSP violation: unknown");
  });

  it("groups violations with no blocked URI under a stable fingerprint", () => {
    reportCspViolations([buildViolation({ blockedUri: null })]);
    expect(mockCaptureMessage.mock.calls[0][1].fingerprint).toEqual([
      "csp-violation",
      "script-src-elem",
      "none",
    ]);
  });

  it("buckets extensions by scheme and collapses unknown schemes and junk", () => {
    reportCspViolations([
      buildViolation({ blockedUri: "chrome-extension://abcd/x.js" }),
      buildViolation({ blockedUri: "random-attacker-string-1" }),
      buildViolation({ blockedUri: "inline" }),
      buildViolation({ blockedUri: "x1://a" }),
    ]);
    const fingerprints = mockCaptureMessage.mock.calls.map(
      (call) => call[1].fingerprint[2],
    );
    expect(fingerprints).toEqual([
      "chrome-extension:",
      "other",
      "inline",
      "other",
    ]);
  });

  it("does nothing for an empty batch", () => {
    reportCspViolations([]);
    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });
});
