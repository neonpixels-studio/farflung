/**
 * Scheduled Netlify Function: hard-deletes users whose soft-delete grace
 * period has elapsed (server/db/schema.ts users.deletedAt). See
 * server/utils/purgeAccounts.ts for the actual query — this file is a thin
 * adapter that wires that logic to a real DB connection and to Netlify's
 * scheduled-function invocation.
 *
 * Deliberately lives outside server/ and is bundled independently by
 * Netlify (not by Nitro): Nitro's netlify preset bundles server/api/**
 * into a single request-driven function, which has no facility for a
 * cron-scheduled invocation. netlify/functions/ is Netlify's own,
 * separate functions directory, wired to a schedule below via
 * netlify.toml ([functions."purge-deleted-accounts"].schedule).
 *
 * Because this file is not part of the Nitro bundle, it cannot use
 * useRuntimeConfig() or any other Nitro auto-import — it reads
 * DATABASE_URL from process.env, filled from the build-time values in
 * scheduled-function-env.ts, via createDb().
 *
 * Security note: Netlify does not expose scheduled functions on a public,
 * directly-invokable HTTP endpoint — they can only be triggered by
 * Netlify's own scheduler (or a project member via the CLI/API), so no
 * additional secret/auth check is added here.
 *
 * Observability note: this file runs outside the Nitro bundle, so it does
 * not get the @sentry/nuxt server instrumentation configured in
 * sentry.server.config.ts. A failed run is logged and then re-thrown (see
 * below) so Netlify's scheduled-function run history records it as a
 * failed invocation, rather than silently returning 200/500 with nothing
 * to consume the status — but there is no active alert wired to that
 * failure yet. Wiring this function into Sentry directly (a separate
 * @sentry/node init, since it isn't bundled by Nitro) is worth doing before
 * this job is depended on for compliance-grade deletion SLAs, but is out of
 * scope for this change; flagged here rather than silently left out.
 */
import { bakedEnvironment } from "../../.generated/scheduled-function-env";
import { applyBakedEnvironment } from "../../scheduled-function-env";
import { createDb } from "../../server/db/index";
import { purgeExpiredDeletedAccounts } from "../../server/utils/purgeAccounts";

export const handler = async () => {
  try {
    applyBakedEnvironment(bakedEnvironment);
    const db = createDb(process.env.DATABASE_URL ?? "");
    const result = await purgeExpiredDeletedAccounts(db);

    console.log(
      `purge-deleted-accounts: purged ${result.purgedCount} account(s)`,
      result.purgedUserIds,
    );

    // Best-effort blob removal that failed leaves orphaned bytes the cascade
    // already erased the DB record for. Surface it at error level so a broken
    // blob store does not read as a run of clean successes.
    if (result.failedBlobKeys.length > 0) {
      console.error(
        `purge-deleted-accounts: ${result.failedBlobKeys.length} media blob(s) failed to delete and remain orphaned`,
        result.failedBlobKeys,
      );
    }

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    // Re-throw (after logging) rather than returning a 500: there is no HTTP
    // caller reading this response, and only an uncaught exception marks the
    // scheduled invocation as failed in Netlify's run history. Swallowing it
    // into a returned status would let a persistently failing purge run
    // "successfully" every night while never purging anything.
    console.error("purge-deleted-accounts: purge run failed", error);
    throw error;
  }
};
