/**
 * Upper bound for any server-side apiFetch call (the guide/trip/profile detail
 * pages' `server: true` fetches, #289). Past this the SSR pass gives up and the
 * page renders its retryable error state instead of hanging the response.
 */
export const SSR_FETCH_TIMEOUT_MS = 5000;
