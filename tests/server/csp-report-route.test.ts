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

import { MAX_CSP_REPORT_BODY_BYTES } from "../../server/utils/cspReports";

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
    mockReadBody.mockRejectedValue(
      Object.assign(new Error("File too large"), { statusCode: 413 }),
    );
    expect(await handle({})).toBeNull();
    expect(mockSetResponseStatus).toHaveBeenCalledWith({}, NO_CONTENT);
    expect(mockReport).not.toHaveBeenCalled();
  });

  it("surfaces unexpected body read failures instead of hiding them", async () => {
    mockReadBody.mockRejectedValue(new Error("stream exploded"));
    await expect(handle({})).rejects.toThrow("stream exploded");
    expect(mockReport).not.toHaveBeenCalled();
  });

  it("caps the body at MAX_CSP_REPORT_BODY_BYTES", async () => {
    mockReadBody.mockResolvedValue(Buffer.from(VALID_BODY));
    await handle({});
    expect(mockReadBody).toHaveBeenCalledWith({}, MAX_CSP_REPORT_BODY_BYTES);
  });
});
