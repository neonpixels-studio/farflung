/**
 * Rejects with a TimeoutError if `pending` hasn't settled within `timeoutMs`.
 *
 * ofetch's own `timeout` option only aborts an AbortSignal, and Nitro's
 * in-process local fetch (what useRequestFetch resolves to during SSR) never
 * observes that signal, so a hung handler would never reject on its own. This
 * race is what actually bounds the server-side wait. It can't cancel the
 * hung handler, which keeps running in the background after the rejection.
 */
export function rejectAfterTimeout<T>(
  pending: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error(
        `[TimeoutError]: The operation timed out after ${timeoutMs}ms`,
      );
      error.name = "TimeoutError";
      reject(error);
    }, timeoutMs);
  });
  return Promise.race([pending, deadline]).finally(() => {
    clearTimeout(timeoutId);
  });
}
