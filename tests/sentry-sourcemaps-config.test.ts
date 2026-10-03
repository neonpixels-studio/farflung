import { afterEach, describe, expect, it, vi } from "vitest";

interface SentryConfig {
  sentry?: {
    sourcemaps?: { filesToDeleteAfterUpload?: string[] };
  };
}

async function loadNuxtConfig(): Promise<SentryConfig> {
  vi.stubGlobal("defineNuxtConfig", (config: unknown) => config);
  vi.resetModules();
  const { default: nuxtConfig } = (await import("../nuxt.config")) as {
    default: SentryConfig;
  };
  return nuxtConfig;
}

describe("nuxt.config.ts Sentry sourcemaps", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("deletes .map files from dist after upload so a failed upload never ships them", async () => {
    const nuxtConfig = await loadNuxtConfig();

    expect(nuxtConfig.sentry?.sourcemaps?.filesToDeleteAfterUpload).toEqual([
      "dist/**/*.map",
    ]);
  });
});
