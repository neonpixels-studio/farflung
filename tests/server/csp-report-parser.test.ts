import { describe, it, expect } from "vitest";
import {
  MAX_CSP_REPORTS_PER_REQUEST,
  parseCspReports,
} from "../../server/utils/cspReports";

const LEGACY_PAYLOAD = {
  "csp-report": {
    "document-uri": "https://farflung.app/trips/1?token=secret#frag",
    "blocked-uri": "https://evil.example/x.js?a=1",
    "effective-directive": "script-src-elem",
    "violated-directive": "script-src",
    disposition: "report",
    "source-file": "https://farflung.app/_nuxt/a.js",
    "line-number": 12,
    "column-number": 3,
    "status-code": 200,
  },
};

const REPORTING_API_PAYLOAD = [
  {
    type: "csp-violation",
    age: 10,
    url: "https://farflung.app/",
    body: {
      documentURL: "https://farflung.app/map?q=private",
      blockedURL: "inline",
      effectiveDirective: "script-src-elem",
      disposition: "report",
      lineNumber: 7,
      columnNumber: 1,
      statusCode: 200,
    },
  },
];

function parseLegacyReport(fields: Record<string, unknown>) {
  return parseCspReports(
    JSON.stringify({
      "csp-report": { "effective-directive": "img-src", ...fields },
    }),
  );
}

describe("parseCspReports", () => {
  it("parses the legacy application/csp-report shape", () => {
    expect(parseCspReports(JSON.stringify(LEGACY_PAYLOAD))).toEqual([
      {
        documentUri: "https://farflung.app/trips/1",
        blockedUri: "https://evil.example/x.js",
        effectiveDirective: "script-src-elem",
        violatedDirective: "script-src",
        disposition: "report",
        sourceFile: "https://farflung.app/_nuxt/a.js",
        lineNumber: 12,
        columnNumber: 3,
        statusCode: 200,
      },
    ]);
  });

  it("parses the Reporting API application/reports+json shape", () => {
    expect(parseCspReports(JSON.stringify(REPORTING_API_PAYLOAD))).toEqual([
      expect.objectContaining({
        documentUri: "https://farflung.app/map",
        blockedUri: "inline",
        effectiveDirective: "script-src-elem",
        lineNumber: 7,
      }),
    ]);
  });

  it("ignores non-CSP report types in a Reporting API batch", () => {
    const batch = [
      { type: "deprecation", body: { id: "x" } },
      ...REPORTING_API_PAYLOAD,
    ];
    expect(parseCspReports(JSON.stringify(batch))).toHaveLength(1);
  });

  it.each([
    ["invalid JSON", "{not json"],
    ["empty body", ""],
    ["a JSON string", '"hello"'],
    ["null", "null"],
    ["an empty object", "{}"],
    ["a csp-report that is not an object", '{"csp-report": "x"}'],
    ["a violation with no directive", '{"csp-report": {"blocked-uri": "x"}}'],
    ["an empty array", "[]"],
  ])("returns no violations for %s", (_label, rawBody) => {
    expect(parseCspReports(rawBody)).toEqual([]);
  });

  it("truncates oversized string fields", () => {
    const longValue = "a".repeat(5000);
    const [violation] = parseLegacyReport({ "blocked-uri": longValue });
    expect(violation.blockedUri).toHaveLength(512);
  });

  it("caps how many reports one request can fan out", () => {
    const flood = Array.from({ length: 100 }, () => REPORTING_API_PAYLOAD[0]);
    expect(parseCspReports(JSON.stringify(flood))).toHaveLength(
      MAX_CSP_REPORTS_PER_REQUEST,
    );
  });

  it("drops non-integer line numbers instead of passing them through", () => {
    const [violation] = parseLegacyReport({ "line-number": "9" });
    expect(violation.lineNumber).toBeNull();
  });

  it.each([
    ["blob:https://farflung.app/abc-123", "blob:https://farflung.app/abc-123"],
    ["chrome-extension://abcd/x.js?y=1", "chrome-extension://abcd/x.js"],
    ["https://user:pass@evil.example/a?b#c", "https://evil.example/a"],
    ["inline", "inline"],
  ])("sanitizes blocked URI %s", (blockedUri, expected) => {
    const [violation] = parseLegacyReport({ "blocked-uri": blockedUri });
    expect(violation.blockedUri).toBe(expected);
  });

  it.each(["script-src<script>", "SCRIPT-SRC", "made-up-directive"])(
    "rejects the malformed directive %s",
    (directive) => {
      const payload = { "csp-report": { "effective-directive": directive } };
      expect(parseCspReports(JSON.stringify(payload))).toEqual([]);
    },
  );

  it("nulls out unknown dispositions", () => {
    const [violation] = parseLegacyReport({ disposition: "x" });
    expect(violation.disposition).toBeNull();
  });

  it("never leaks credentials or query from a URL cut mid-userinfo", () => {
    const secret = "s".repeat(600);
    const [violation] = parseLegacyReport({
      "blocked-uri": `https://user:${secret}@host.example/p?token=abc`,
    });
    expect(violation.blockedUri).toBe("https://host.example/p");
  });

  it("strips credentials and query from URLs the parser rejects", () => {
    const [violation] = parseLegacyReport({
      "blocked-uri": "https://user:pw@host:notaport/p?token=abc#x",
    });
    expect(violation.blockedUri).toBe(
      "https://user:pw@host:notaport/p".split("@")[1],
    );
  });
});
