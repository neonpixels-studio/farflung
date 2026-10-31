import { getDb } from "../../../db/index";
import { requireUser } from "../../../utils/auth";
import { requireRouterParam } from "../../../utils/db-helpers";
import {
  describeHandleProblem,
  findHandleProblem,
} from "../../../utils/handle";
import { isHandleTaken } from "../../../utils/handle-queries";

/**
 * GET /api/handles/<handle>/availability
 *
 * Powers the live check next to the handle field. Requires a session (it is
 * not in the optional-auth allowlist) so it can't be used anonymously to
 * enumerate handles. The unique index on lower(handle) remains the real
 * guarantee; this is only advisory.
 */
export default defineEventHandler(async (event) => {
  const userId = requireUser(event);
  const handle = requireRouterParam(event, "handle");

  const problem = findHandleProblem(handle);
  if (problem) {
    return {
      available: false,
      reason: problem,
      message: describeHandleProblem(problem),
    };
  }

  if (await isHandleTaken(getDb(), handle, userId)) {
    return {
      available: false,
      reason: "taken",
      message: "That handle is already taken",
    };
  }

  return { available: true, reason: null, message: null };
});
