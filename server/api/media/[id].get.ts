import { eq } from "drizzle-orm";
import { getDb } from "../../db/index";
import { media } from "../../db/schema";
import { getMediaBlob } from "../../utils/mediaStore";
import { verifyMediaSignature } from "../../utils/mediaUrl";

const FALLBACK_CONTENT_TYPE = "application/octet-stream";

// Reached without a Bearer token (see server/middleware/auth.ts), so the signature
// issued by buildSignedMediaPath is the access control. DELETE enforces ownership.
export default defineEventHandler(async (event) => {
  const mediaId = getRouterParam(event, "id");
  if (!mediaId) {
    throw createError({ statusCode: 400, statusMessage: "Missing media id" });
  }

  const secondsLeft = verifyMediaSignature(
    mediaId,
    "original",
    getQuery(event),
  );
  if (secondsLeft === null) {
    throw createError({ statusCode: 403, statusMessage: "Invalid media link" });
  }

  const db = getDb();
  const rows = await db
    .select({ url: media.url, contentType: media.contentType })
    .from(media)
    .where(eq(media.id, mediaId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: "Not found" });
  }

  const blob = await getMediaBlob(row.url);
  if (!blob) {
    throw createError({ statusCode: 404, statusMessage: "Blob not found" });
  }

  const resolvedContentType =
    blob.contentType ?? row.contentType ?? FALLBACK_CONTENT_TYPE;

  setResponseHeader(event, "Content-Type", resolvedContentType);
  // Private so a shared cache can't outlive the signature.
  setResponseHeader(event, "Cache-Control", `private, max-age=${secondsLeft}`);
  setResponseHeader(event, "X-Content-Type-Options", "nosniff");

  return new Uint8Array(blob.data);
});
