/**
 * Thin abstraction over Netlify Blobs so API handlers can be unit-tested
 * without hitting the network. Import and use these functions rather than
 * calling @netlify/blobs directly in handlers.
 */
import { getStore } from "@netlify/blobs";

export const MEDIA_STORE_NAME = "media";

// Content-type metadata key stored alongside each blob.
export const BLOB_CONTENT_TYPE_KEY = "contentType";

// Suffix appended to an original's storage key to get its thumbnail's key,
// e.g. "user-1/media-123" -> "user-1/media-123-thumb". Keeping the thumbnail
// alongside the original under a derived key means no extra DB column is
// needed to look it up.
const THUMBNAIL_KEY_SUFFIX = "-thumb";

function openStore(): ReturnType<typeof getStore> {
  return getStore(MEDIA_STORE_NAME);
}

export function toThumbnailKey(storageKey: string): string {
  return `${storageKey}${THUMBNAIL_KEY_SUFFIX}`;
}

export async function putMediaBlob(
  key: string,
  data: Buffer,
  contentType: string,
): Promise<void> {
  const store = openStore();
  await store.set(key, new Uint8Array(data).buffer, {
    metadata: { [BLOB_CONTENT_TYPE_KEY]: contentType },
  });
}

export async function getMediaBlob(key: string): Promise<{
  data: ArrayBuffer;
  contentType: string | null;
} | null> {
  const store = openStore();
  const result = await store.getWithMetadata(key, { type: "arrayBuffer" });

  if (!result) {
    return null;
  }

  const contentType =
    typeof result.metadata?.[BLOB_CONTENT_TYPE_KEY] === "string"
      ? result.metadata[BLOB_CONTENT_TYPE_KEY]
      : null;

  return { data: result.data as ArrayBuffer, contentType };
}

// Existence check that reads only the blob's metadata, so callers that just
// need to know whether a thumbnail exists don't download its bytes.
export async function mediaBlobExists(key: string): Promise<boolean> {
  const store = openStore();
  const metadata = await store.getMetadata(key);
  return metadata !== null;
}

export async function removeMediaBlob(key: string): Promise<void> {
  const store = openStore();
  await store.delete(key);
}
