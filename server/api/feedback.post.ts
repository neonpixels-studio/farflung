import { requireUser } from "../utils/auth";
import { requireString } from "../utils/db-helpers";
import {
  requireNeonPixelsDashboardToken,
  sendFeedback,
  type FeedbackPayload,
} from "../utils/neonPixelsDashboard";

const MESSAGE_MAX_LENGTH = 5000;
const EMAIL_MAX_LENGTH = 320;
const URL_MAX_LENGTH = 2048;

function requireBoundedString(
  value: unknown,
  fieldName: string,
  maxLength: number,
): string {
  requireString(value, fieldName);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} must be at most ${maxLength} characters`,
    });
  }
  return trimmed;
}

function validateFeedback(body: unknown): FeedbackPayload {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Request body must be a JSON object",
    });
  }

  const fields = body as Record<string, unknown>;
  return {
    message: requireBoundedString(
      fields.message,
      "message",
      MESSAGE_MAX_LENGTH,
    ),
    email: requireBoundedString(fields.email, "email", EMAIL_MAX_LENGTH),
    url: requireBoundedString(fields.url, "url", URL_MAX_LENGTH),
  };
}

export default defineEventHandler(async (event) => {
  requireUser(event);
  const payload = validateFeedback(await readBody(event));

  // Resolved outside the try below so a missing token surfaces as a 500
  // (server misconfiguration), not a 502 (dashboard failure).
  const token = requireNeonPixelsDashboardToken();

  try {
    await sendFeedback(payload, token);
  } catch (error) {
    console.error("feedback: dashboard submission failed", error);
    throw createError({
      statusCode: 502,
      statusMessage: "Feedback could not be sent; please try again",
    });
  }

  return { ok: true };
});
