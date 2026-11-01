import { listApiKeys } from "../../utils/apiKeys";
import { requireUser } from "../../utils/auth";

export default defineEventHandler((event) => {
  const userId = requireUser(event);
  return listApiKeys(userId);
});
