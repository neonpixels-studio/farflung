import { describe, it, expect, vi, beforeEach } from "vitest";
import { stubNitroGlobals } from "./test-utils";

stubNitroGlobals();

const { mockSetResponseStatus, mockReadBody, mockReport } = vi.hoisted(() => ({
  mockSetResponseStatus: vi.fn(),
  mockReadBody: vi.fn(),
  mockReport: vi.fn(),
}));

Object.assign(globalThis, { setResponseStatus: mockSetResponseStatus });

vi.mock("../../server/utils/readCappedUploadBody", () => ({
  readCappedUploadBody: mockReadBody,
}));
vi.mock("../../server/utils/cspReportSink", () => ({
  reportCspViolations: mockReport,
}));

const { default: handler } =
  await import("../../server/routes/csp-report.post");
const handle = handler as (event: unknown) => Promise<unknown>;
const NO_CONTENT = 204;

const VALID_BODY = JSON.stringify({
  "csp-report": { "effective-directive": "img-src", "blocked-uri": "inline" },
});

describe("POST /csp-report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards parsed violations to the sink and answers 204 with no body", async () => {
    mockReadBody.mockResolvedValue(Buffer.from(VALID_BODY));
    const result = await handle({});
    expect(result).toBeNull();
    expect(mockSetResponseStatus).toHaveBeenCalledWith({}, NO_CONTENT);
    expect(mockReport).toHaveBeenCalledWith([
      expect.objectContaining({ effectiveDirective: "img-src" }),
    ]);
  });

  it("answers 204 and reports nothing for malformed JSON", async () => {
    mockReadBody.mockResolvedValue(Buffer.from("{nope"));
    expect(await handle({})).toBeNull();
    expect(mockSetResponseStatus).toHaveBeenCalledWith({}, NO_CONTENT);
    expect(mockReport).toHaveBeenCalledWith([]);
  });

  it("answers 204 and reports nothing when the body exceeds the cap", async () => {
    mockReadBody.mockRejectedValue(new Error("too large"));
    expect(await handle({})).toBeNull();
    expect(mockSetResponseStatus).toHaveBeenCalledWith({}, NO_CONTENT);
    expect(mockReport).not.toHaveBeenCalled();
  });
});
