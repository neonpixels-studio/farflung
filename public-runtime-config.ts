/**
 * Public runtime config, read from the environment at build time. dotenvx only
 * populates process.env during `nuxt build`, and Nitro's own NUXT_PUBLIC_*
 * override only reads the deployed function's runtime environment, so a value
 * not captured here reaches production blank. Kept Nuxt-free so that wiring is
 * unit testable (see tests/public-runtime-config.test.ts).
 */
type BuildEnvironment = Record<string, string | undefined>;

export function buildPublicRuntimeConfig(environment: BuildEnvironment) {
  return {
    sentryDsn: environment.NUXT_PUBLIC_SENTRY_DSN || "",
    siteOrigin: environment.NUXT_PUBLIC_SITE_ORIGIN || "",
    mapboxToken: environment.NUXT_PUBLIC_MAPBOX_TOKEN || "",
    // GA4 measurement ID, set only in .env.production. The client plugin no-ops
    // when blank, so analytics loads in production builds alone.
    googleAnalyticsId: environment.NUXT_PUBLIC_GOOGLE_ANALYTICS_ID || "",
  };
}
