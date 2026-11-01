import type { H3Event } from "h3";
import { and, eq } from "drizzle-orm";
import { buildSignedMediaPath } from "../../utils/mediaUrl";
import { getDb } from "../../db/index";
import { MEDIA_SOURCE, media } from "../../db/schema";
import { ensureUser } from "../../utils/auth";
import {
  mediaBlobExists,
  removeMediaBlob,
  toThumbnailKey,
} from "../../utils/mediaStore";
import { assertPhotoLimit } from "../../utils/planLimits";
import type { ImageDimensions } from "../../utils/imageProcessing";
import { processMediaImage, storeMediaBlobs } from "../../utils/mediaPipeline";
import {
  createFileTooLargeError,
  discardUploadBody,
  readCappedUploadBody,
} from "../../utils/readCappedUploadBody";

// 10 MB expressed in bytes.
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
]);

const FALLBACK_HOST = "localhost:3000";

// Sources a client may claim on upload. MEDIA_SOURCE.INSTAGRAM is left out on
// purpose: it stays reserved for the server-side import.
const CLIENT_SETTABLE_SOURCES: readonly string[] = [MEDIA_SOURCE.BACKFILL];

const MAX_SOURCE_ID_LENGTH = 255;

const POSTGRES_UNIQUE_VIOLATION = "23505";
const MEDIA_SOURCE_UNIQUE_CONSTRAINT = "media_user_source_source_id_unique";

interface InsertedMediaRow {
  id: string;
  url: string;
}

interface MediaSourceKey {
  source: string;
  sourceId: string;
}

interface ExistingMediaRow {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
}

interface MediaRowInput {
  sourceKey: MediaSourceKey | null;
  mediaId: string;
  userId: string;
  storageKey: string;
  thumbnailKey: string | null;
  contentType: string;
  dimensions: ImageDimensions | null;
}

interface UploadResponseUrls {
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
}

function badSourceRequest(statusMessage: string) {
  return createError({ statusCode: 400, statusMessage });
}

function parseSource(source: unknown): string {
  if (typeof source !== "string" || !CLIENT_SETTABLE_SOURCES.includes(source)) {
    throw badSourceRequest(
      `source must be one of: ${CLIENT_SETTABLE_SOURCES.join(", ")}`,
    );
  }
  return source;
}

function parseSourceId(sourceId: unknown): string {
  const trimmed = typeof sourceId === "string" ? sourceId.trim() : "";
  if (!trimmed || trimmed.length > MAX_SOURCE_ID_LENGTH) {
    throw badSourceRequest(
      `sourceId must be a non-empty string of at most ${MAX_SOURCE_ID_LENGTH} characters`,
    );
  }
  return trimmed;
}

// `source`/`sourceId` come from the query because the body is the raw image.
function parseMediaSourceKey(event: H3Event): MediaSourceKey | null {
  const { source, sourceId } = getQuery(event);
  if (source === undefined && sourceId === undefined) {
    return null;
  }
  if (source === undefined || sourceId === undefined) {
    throw badSourceRequest("source and sourceId must be provided together");
  }
  return { source: parseSource(source), sourceId: parseSourceId(sourceId) };
}

async function findMediaBySourceKey(
  userId: string,
  sourceKey: MediaSourceKey,
): Promise<ExistingMediaRow | null> {
  const rows = await getDb()
    .select({
      id: media.id,
      url: media.url,
      width: media.width,
      height: media.height,
    })
    .from(media)
    .where(
      and(
        eq(media.userId, userId),
        eq(media.source, sourceKey.source),
        eq(media.sourceId, sourceKey.sourceId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

// Drizzle wraps driver errors in DrizzleQueryError, leaving the fields on `cause`.
function isMediaSourceUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const { cause } = error as { cause?: unknown };
  const driverError = (cause ?? error) as {
    code?: string;
    constraint?: string;
  };
  return (
    driverError.code === POSTGRES_UNIQUE_VIOLATION &&
    driverError.constraint === MEDIA_SOURCE_UNIQUE_CONSTRAINT
  );
}

function assertContentTypeAllowed(contentType: string): void {
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw createError({
      statusCode: 415,
      statusMessage: `Unsupported media type. Allowed: ${[...ALLOWED_CONTENT_TYPES].join(", ")}`,
    });
  }
}

function assertFileSizeAllowed(byteLength: number): void {
  if (byteLength > MAX_FILE_SIZE_BYTES) {
    throw createFileTooLargeError(MAX_FILE_SIZE_BYTES);
  }
}

function resolveContentType(event: H3Event): string {
  // Strip any parameters (e.g. "image/jpeg; charset=binary" → "image/jpeg").
  return (getHeader(event, "content-type") ?? "").split(";")[0].trim();
}

// Reject early on Content-Length before reading the body at all. This is
// only a fast path for honest clients — the real backstop against a
// malicious client that omits or understates Content-Length is the byte cap
// `readCappedUploadBody` enforces while the body streams in.
async function readValidatedUploadBuffer(event: H3Event): Promise<Buffer> {
  const declaredLength = Number(getHeader(event, "content-length") ?? 0);
  // A malformed header (e.g. non-numeric) makes this NaN, which fails the
  // `>` comparison in assertFileSizeAllowed and so is silently let through
  // this early gate rather than rejected outright — intentional, since the
  // streaming cap below is the real backstop either way and a garbage
  // header shouldn't be trusted enough to reject on directly.
  assertFileSizeAllowed(declaredLength);

  const rawBody = await readCappedUploadBody(event, MAX_FILE_SIZE_BYTES);
  if (!rawBody || rawBody.byteLength === 0) {
    throw createError({ statusCode: 400, statusMessage: "Empty request body" });
  }

  return rawBody;
}

async function cleanupOrphanedBlobs(
  storageKey: string,
  thumbnailKey: string | null,
): Promise<void> {
  try {
    await removeMediaBlob(storageKey);
    if (thumbnailKey) {
      await removeMediaBlob(thumbnailKey);
    }
  } catch (cleanupError) {
    console.error(
      `media post: blob cleanup failed for ${storageKey}`,
      cleanupError,
    );
  }
}

function buildMediaRowValues(input: MediaRowInput) {
  return {
    id: input.mediaId,
    userId: input.userId,
    url: input.storageKey,
    contentType: input.contentType,
    width: input.dimensions?.width ?? null,
    height: input.dimensions?.height ?? null,
    source: input.sourceKey?.source ?? null,
    sourceId: input.sourceKey?.sourceId ?? null,
  };
}

// Inserts the media row. On failure, cleans up the blob(s) already written
// so storage doesn't end up with an orphaned original and/or thumbnail, then
// re-throws the original insert error.
async function insertMediaRow(input: MediaRowInput): Promise<InsertedMediaRow> {
  const db = getDb();

  try {
    const insertedRows = await db
      .insert(media)
      .values(buildMediaRowValues(input))
      .returning({ id: media.id, url: media.url });

    const inserted = insertedRows[0];
    if (!inserted) {
      throw createError({
        statusCode: 500,
        statusMessage: "Failed to insert media record",
      });
    }
    return inserted;
  } catch (insertError) {
    await cleanupOrphanedBlobs(input.storageKey, input.thumbnailKey);
    throw insertError;
  }
}

function buildUploadResponseUrls(
  event: H3Event,
  mediaId: string,
  thumbnailKey: string | null,
  dimensions: ImageDimensions | null,
): UploadResponseUrls {
  const host = getHeader(event, "host") ?? FALLBACK_HOST;
  const protocol = getRequestProtocol(event);
  const url = `${protocol}://${host}${buildSignedMediaPath(mediaId)}`;
  const thumbnailUrl = thumbnailKey
    ? `${protocol}://${host}${buildSignedMediaPath(mediaId, "thumbnail")}`
    : null;

  return {
    url,
    thumbnailUrl,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
  };
}

// Same shape as a fresh upload, returned with 200 so a client can tell a replay
// from a new row. Asks blob storage whether a thumbnail exists because that is
// what GET /api/media/[id]/thumbnail goes by; no column records it.
async function buildExistingMediaResponse(
  event: H3Event,
  row: ExistingMediaRow,
) {
  const thumbnailKey = toThumbnailKey(row.url);
  const hasThumbnail = await mediaBlobExists(thumbnailKey);
  const dimensions =
    row.width !== null && row.height !== null
      ? { width: row.width, height: row.height }
      : null;

  setResponseStatus(event, 200);

  return {
    id: row.id,
    ...buildUploadResponseUrls(
      event,
      row.id,
      hasThumbnail ? thumbnailKey : null,
      dimensions,
    ),
  };
}

// Handles losing the race to another upload with the same source key:
// insertMediaRow has already removed this request's blobs, so all that's left is
// to answer with the row that won. Returns null for any other insert failure.
async function resolveLostSourceKeyRace(
  event: H3Event,
  userId: string,
  sourceKey: MediaSourceKey | null,
  insertError: unknown,
) {
  if (!sourceKey || !isMediaSourceUniqueViolation(insertError)) {
    return null;
  }
  const winner = await findMediaBySourceKey(userId, sourceKey);
  return winner ? buildExistingMediaResponse(event, winner) : null;
}

async function uploadNewMedia(
  event: H3Event,
  userId: string,
  sourceKey: MediaSourceKey | null,
) {
  await assertPhotoLimit(userId);

  const contentType = resolveContentType(event);
  assertContentTypeAllowed(contentType);

  const originalBuffer = await readValidatedUploadBuffer(event);

  const mediaId = crypto.randomUUID();
  const storageKey = `${userId}/${mediaId}`;

  const { dimensions, thumbnailBuffer } =
    await processMediaImage(originalBuffer);
  const thumbnailKey = await storeMediaBlobs(
    storageKey,
    originalBuffer,
    thumbnailBuffer,
    contentType,
  );

  let inserted: InsertedMediaRow;
  try {
    inserted = await insertMediaRow({
      sourceKey,
      mediaId,
      userId,
      storageKey,
      thumbnailKey,
      contentType,
      dimensions,
    });
  } catch (insertError) {
    const winnerResponse = await resolveLostSourceKeyRace(
      event,
      userId,
      sourceKey,
      insertError,
    );
    if (winnerResponse) {
      return winnerResponse;
    }
    throw insertError;
  }

  const responseUrls = buildUploadResponseUrls(
    event,
    mediaId,
    thumbnailKey,
    dimensions,
  );

  setResponseStatus(event, 201);

  return {
    id: inserted.id,
    ...responseUrls,
  };
}

export default defineEventHandler(async (event) => {
  const userId = await ensureUser(event);

  const sourceKey = parseMediaSourceKey(event);
  const existing = sourceKey
    ? await findMediaBySourceKey(userId, sourceKey)
    : null;
  if (existing) {
    await discardUploadBody(event);
    return buildExistingMediaResponse(event, existing);
  }

  return uploadNewMedia(event, userId, sourceKey);
});
