import {
  MAX_CSP_REPORT_BODY_BYTES,
  parseCspReports,
} from "../utils/cspReports";
import { reportCspViolations } from "../utils/cspReportSink";
import { readCappedUploadBody } from "../utils/readCappedUploadBody";

const NO_CONTENT = 204;

// CSP report collector (#305). Lives at /csp-report rather than under /api/
// because browsers send reports without credentials and server/middleware/
// auth.ts guards every /api/ path. Rate limited by IP (rateLimitPolicies.ts).
// Always answers 204 with no body: oversized, unreadable or malformed reports
// are dropped silently, and nothing from the request is echoed back.
export default defineEventHandler(async (event) => {
  setResponseStatus(event, NO_CONTENT);

  const rawBody = await readCappedUploadBody(
    event,
    MAX_CSP_REPORT_BODY_BYTES,
  ).catch(() => null);
  if (!rawBody) {
    return null;
  }

  reportCspViolations(parseCspReports(rawBody.toString("utf8")));
  return null;
});
