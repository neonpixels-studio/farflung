import { describe, it, expect, beforeEach } from "vitest";
import {
  buildSignedMediaPath,
  verifyMediaSignature,
} from "../../server/utils/mediaUrl";

const NOW = 1_800_000_000;
const SEVEN_DAYS = 7 * 86_400;

function queryFrom(path: string) {
  const params = new URL(path, "https://x.test").searchParams;
  return { exp: params.get("exp"), sig: params.get("sig") };
}

describe("signed media URLs", () => {
  beforeEach(() => {
    process.env.NUXT_CLERK_SECRET_KEY = "sk_test_signing";
  });

  it("accepts a URL it issued and reports the time left", () => {
    const query = queryFrom(buildSignedMediaPath("media-1", "original", NOW));
    const secondsLeft = verifyMediaSignature("media-1", "original", query, NOW);
    expect(secondsLeft).toBeGreaterThanOrEqual(SEVEN_DAYS);
  });

  it("targets the thumbnail route for thumbnails", () => {
    expect(buildSignedMediaPath("media-1", "thumbnail", NOW)).toMatch(
      /^\/api\/media\/media-1\/thumbnail\?exp=/,
    );
  });

  it("returns the same URL through a day, so browser caching works", () => {
    const dayStart = Math.floor(NOW / 86_400) * 86_400;
    expect(buildSignedMediaPath("media-1", "original", dayStart + 1)).toBe(
      buildSignedMediaPath("media-1", "original", dayStart + 80_000),
    );
  });

  it("rejects an expired URL", () => {
    const query = queryFrom(buildSignedMediaPath("media-1", "original", NOW));
    const later = NOW + SEVEN_DAYS + 2 * 86_400;
    expect(
      verifyMediaSignature("media-1", "original", query, later),
    ).toBeNull();
  });

  it("rejects a signature for a different photo", () => {
    const query = queryFrom(buildSignedMediaPath("media-1", "original", NOW));
    expect(verifyMediaSignature("media-2", "original", query, NOW)).toBeNull();
  });

  it("rejects a thumbnail signature used on the original", () => {
    const query = queryFrom(buildSignedMediaPath("media-1", "thumbnail", NOW));
    expect(verifyMediaSignature("media-1", "original", query, NOW)).toBeNull();
  });

  it("rejects an extended expiry", () => {
    const query = queryFrom(buildSignedMediaPath("media-1", "original", NOW));
    const tampered = { ...query, exp: String(Number(query.exp) + 86_400) };
    expect(
      verifyMediaSignature("media-1", "original", tampered, NOW),
    ).toBeNull();
  });

  it("rejects a missing or malformed signature", () => {
    expect(verifyMediaSignature("media-1", "original", {}, NOW)).toBeNull();
    expect(
      verifyMediaSignature(
        "media-1",
        "original",
        { exp: String(NOW + 100), sig: "short" },
        NOW,
      ),
    ).toBeNull();
  });
});
