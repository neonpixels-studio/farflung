import { eq } from "drizzle-orm";
import { getDb } from "../../../db/index";
import { media } from "../../../db/schema";
import { getMediaBlob, toThumbnailKey } from "../../../utils/mediaStore";
import { verifyMediaSignature } from "../../../utils/mediaUrl";

const FALLBACK_CONTENT_TYPE = "application/octet-stream";

// Same signed access as ../[id].get.ts. 404s when no
// thumbnail was generated for this media (e.g. probing/resize failed at
// upload time) rather than falling back to the original.
export default defineEventHandler(async (event) => {
  const mediaId = getRouterParam(event, "id");
  if (!mediaId) {
    throw createError({ statusCode: 400, statusMessage: "Missing media id" });
  }

  const secondsLeft = verifyMediaSignature(
    mediaId,
    "thumbnail",
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

  const blob = await getMediaBlob(toThumbnailKey(row.url));
  if (!blob) {
    throw createError({
      statusCode: 404,
      statusMessage: "Thumbnail not found",
    });
  }

  const resolvedContentType =
    blob.contentType ?? row.contentType ?? FALLBACK_CONTENT_TYPE;

  setResponseHeader(event, "Content-Type", resolvedContentType);
  // Private so a shared cache can't outlive the signature.
  setResponseHeader(event, "Cache-Control", `private, max-age=${secondsLeft}`);
  setResponseHeader(event, "X-Content-Type-Options", "nosniff");

  return new Uint8Array(blob.data);
});
