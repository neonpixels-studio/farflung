import { revokeApiKey } from "../../utils/apiKeys";
import { requireUser } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const userId = requireUser(event);

  const apiKeyId = getRouterParam(event, "id");
  if (!apiKeyId) {
    throw createError({ statusCode: 400, statusMessage: "Missing API key id" });
  }

  if (!(await revokeApiKey(userId, apiKeyId))) {
    // 404 whether unknown or another user's, to avoid leaking existence.
    throw createError({ statusCode: 404, statusMessage: "Not found" });
  }

  return { ok: true };
});
