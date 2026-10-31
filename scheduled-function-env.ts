/**
 * Netlify bundles netlify/functions/* separately from Nitro, so those functions
 * can't reach the values baked into runtimeConfig, and dotenvx only runs during
 * the build. nuxt.config.ts writes these values to a gitignored module at build
 * time, and each function loads them into process.env before doing any work.
 */
const SCHEDULED_FUNCTION_ENV_KEYS = [
  "DATABASE_URL",
  "TOKEN_ENCRYPTION_KEY",
] as const;

export const SCHEDULED_FUNCTION_ENV_MODULE_PATH =
  ".generated/scheduled-function-env.ts";

type Environment = Record<string, string | undefined>;

export function renderScheduledFunctionEnvModule(
  environment: Environment,
): string {
  const bakedEnvironment = Object.fromEntries(
    SCHEDULED_FUNCTION_ENV_KEYS.map((key) => [key, environment[key] || ""]),
  );
  return `export const bakedEnvironment = ${JSON.stringify(bakedEnvironment, null, 2)};\n`;
}

// A raw runtime env var still wins, matching `process.env.X || config.x` in server/.
export function applyBakedEnvironment(
  bakedEnvironment: Environment,
  environment: Environment = process.env,
): void {
  for (const key of SCHEDULED_FUNCTION_ENV_KEYS) {
    if (environment[key] || !bakedEnvironment[key]) {
      continue;
    }
    environment[key] = bakedEnvironment[key];
  }
}
