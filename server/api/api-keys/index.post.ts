import {
  MAX_ACTIVE_API_KEYS,
  countActiveApiKeys,
  insertApiKey,
} from "../../utils/apiKeys";
import { MS_PER_DAY } from "../../utils/accountLifecycle";
import { ensureUser } from "../../utils/auth";

const MAX_NAME_LENGTH = 100;
const MAX_EXPIRES_IN_DAYS = 3650;

function badRequest(statusMessage: string) {
  return createError({ statusCode: 400, statusMessage });
}

function parseName(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name || name.length > MAX_NAME_LENGTH) {
    throw badRequest(
      `name must be a non-empty string of at most ${MAX_NAME_LENGTH} characters`,
    );
  }
  return name;
}

function parseExpiresAt(value: unknown): Date | null {
  if (value === undefined || value === null) {
    return null;
  }
  const isValidDayCount =
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= MAX_EXPIRES_IN_DAYS;
  if (!isValidDayCount) {
    throw badRequest(
      `expiresInDays must be a whole number from 1 to ${MAX_EXPIRES_IN_DAYS}`,
    );
  }
  return new Date(Date.now() + value * MS_PER_DAY);
}

export default defineEventHandler(async (event) => {
  const userId = await ensureUser(event);
  const body = (await readBody(event)) as Record<string, unknown> | null;
  const name = parseName(body?.name);
  const expiresAt = parseExpiresAt(body?.expiresInDays);

  if ((await countActiveApiKeys(userId)) >= MAX_ACTIVE_API_KEYS) {
    throw badRequest(
      `You can have at most ${MAX_ACTIVE_API_KEYS} active API keys. Revoke one to create another.`,
    );
  }

  const created = await insertApiKey({ userId, name, expiresAt });
  setResponseStatus(event, 201);
  return created;
});
