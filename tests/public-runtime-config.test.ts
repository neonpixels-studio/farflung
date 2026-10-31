import { describe, expect, it } from "vitest";
import { buildPublicRuntimeConfig } from "../public-runtime-config";

describe("buildPublicRuntimeConfig", () => {
  it("captures each public value from the build environment", () => {
    expect(
      buildPublicRuntimeConfig({
        NUXT_PUBLIC_SENTRY_DSN: "https://key@sentry.example/1",
        NUXT_PUBLIC_SITE_ORIGIN: "https://farflung.io",
        NUXT_PUBLIC_MAPBOX_TOKEN: "pk.mapbox",
        NUXT_PUBLIC_GOOGLE_ANALYTICS_ID: "G-TEST",
      }),
    ).toEqual({
      sentryDsn: "https://key@sentry.example/1",
      siteOrigin: "https://farflung.io",
      mapboxToken: "pk.mapbox",
      googleAnalyticsId: "G-TEST",
    });
  });

  it("falls back to blank strings when the environment has no values", () => {
    expect(buildPublicRuntimeConfig({})).toEqual({
      sentryDsn: "",
      siteOrigin: "",
      mapboxToken: "",
      googleAnalyticsId: "",
    });
  });
});
