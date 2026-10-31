import type { H3Event } from "h3";
import { eq } from "drizzle-orm";
import { getDb } from "../../db/index";
import { users } from "../../db/schema";
import { signupsDisabled } from "../../utils/auth";
import {
  verifySvixSignature,
  SVIX_ID_HEADER,
  SVIX_TIMESTAMP_HEADER,
  SVIX_SIGNATURE_HEADER,
  type SvixHeaders,
} from "../../utils/svix";

// Clerk webhook event type strings.
const EVENT_USER_CREATED = "user.created";
const EVENT_USER_UPDATED = "user.updated";
const EVENT_USER_DELETED = "user.deleted";

const POSTGRES_UNIQUE_VIOLATION = "23505";

interface ClerkEmailAddress {
  id: string;
  email_address: string;
}

// user.created and user.updated payloads include full user data.
interface ClerkUserUpsertPayload {
  id: string;
  email_addresses?: ClerkEmailAddress[];
  primary_email_address_id?: string;
}

// user.deleted payloads only carry the id; email fields are absent.
interface ClerkUserDeletedPayload {
  id: string;
}

interface ClerkWebhookEvent {
  type: string;
  data: ClerkUserUpsertPayload | ClerkUserDeletedPayload;
}

function getWebhookSecret(): string {
  const secret =
    process.env.NUXT_CLERK_WEBHOOK_SECRET ||
    useRuntimeConfig().clerkWebhookSecret;
  if (!secret) {
    throw createError({
      statusCode: 500,
      statusMessage: "NUXT_CLERK_WEBHOOK_SECRET is not configured",
    });
  }
  return secret;
}

function extractSvixHeaders(event: H3Event): SvixHeaders {
  return {
    [SVIX_ID_HEADER]: getHeader(event, SVIX_ID_HEADER) ?? "",
    [SVIX_TIMESTAMP_HEADER]: getHeader(event, SVIX_TIMESTAMP_HEADER) ?? "",
    [SVIX_SIGNATURE_HEADER]: getHeader(event, SVIX_SIGNATURE_HEADER) ?? "",
  };
}

function extractPrimaryEmail(
  payload: ClerkUserUpsertPayload,
): string | undefined {
  return payload.email_addresses?.find(
    (address) => address.id === payload.primary_email_address_id,
  )?.email_address;
}

// Drizzle wraps driver errors in DrizzleQueryError, leaving the code on `cause`.
function isUniqueViolation(error: unknown): boolean {
  const { code, cause } = error as {
    code?: string;
    cause?: { code?: string };
  };
  return (cause?.code ?? code) === POSTGRES_UNIQUE_VIOLATION;
}

async function handleUserUpsert(
  payload: ClerkUserUpsertPayload,
): Promise<void> {
  const email = extractPrimaryEmail(payload);

  // Clerk users created via phone or SSO may have no primary email.
  // Acknowledge and skip rather than returning a non-2xx that causes Svix retries.
  // On user.updated with email removed we keep the existing DB value since
  // users.email is NOT NULL.
  if (!email) {
    return;
  }

  const db = getDb();

  // Invite-only mode: mirror updates for users who already have a row, but never
  // provision a brand-new one, so a Clerk account that slipped through still gets
  // no usable app-DB row. This matches the ensureUser gate on the request path.
  if (signupsDisabled()) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, payload.id))
      .limit(1);
    if (existing.length === 0) {
      return;
    }
  }

  // Note: Svix does not guarantee delivery order. A delayed user.updated could
  // arrive after a newer event. We accept this risk and do not guard against it
  // here since Clerk's webhook payloads carry no stable sequence number.
  try {
    await db
      .insert(users)
      .values({ id: payload.id, email })
      .onConflictDoUpdate({
        target: users.id,
        set: { email },
      });
  } catch (error) {
    console.error(`Clerk webhook: could not upsert user ${payload.id}`, error);

    // The email already belongs to a different users row (e.g. a delete/re-signup
    // race). Retrying can't fix that, so acknowledge it. Anything else may be
    // transient, so fail and let Svix redeliver rather than lose the user.
    if (isUniqueViolation(error)) {
      return;
    }
    throw createError({
      statusCode: 500,
      statusMessage: "Could not save Clerk user",
    });
  }
}

async function handleUserDelete(
  payload: ClerkUserDeletedPayload,
): Promise<void> {
  const db = getDb();
  await db.delete(users).where(eq(users.id, payload.id));
}

export default defineEventHandler(async (event) => {
  const rawBody = await readRawBody(event);
  if (!rawBody) {
    throw createError({ statusCode: 400, statusMessage: "Empty request body" });
  }

  const secret = getWebhookSecret();
  const svixHeaders = extractSvixHeaders(event);

  let webhookEvent: ClerkWebhookEvent;
  try {
    webhookEvent = verifySvixSignature<ClerkWebhookEvent>(
      rawBody,
      svixHeaders,
      secret,
    );
  } catch (error) {
    console.error("Clerk webhook: Svix signature verification failed", error);
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid webhook signature",
    });
  }

  if (
    webhookEvent.type === EVENT_USER_CREATED ||
    webhookEvent.type === EVENT_USER_UPDATED
  ) {
    await handleUserUpsert(webhookEvent.data as ClerkUserUpsertPayload);
    return { ok: true };
  }

  if (webhookEvent.type === EVENT_USER_DELETED) {
    await handleUserDelete(webhookEvent.data as ClerkUserDeletedPayload);
    return { ok: true };
  }

  // Unknown event types are acknowledged without error so Clerk does not retry.
  return { ok: true };
});
