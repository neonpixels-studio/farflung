/**
 * Whether the viewer's own auth state has had a chance to resolve — either
 * Clerk actually finished loading, or CLERK_BOOTSTRAP_TIMEOUT_MS lapsed
 * without it (Clerk's script blocked by an ad blocker, a flaky CDN).
 *
 * guides/[id].vue, trips/[id].vue, and u/[id].vue all use this to withhold a
 * "not found" / signed-out UI until it's resolved: with `server: true`
 * (#289), the SSR pass for these pages always fetches anonymously (see
 * useClerkGatedFetch's import.meta.server fast-path), so a private
 * resource's "not found" from that pass doesn't yet mean anything about
 * *this* viewer specifically — it could just mean the viewer, not yet known
 * to be the owner, hasn't had their authenticated retry run yet. Showing
 * "not found" (or a signed-out prompt) before that resolves would regress
 * #255, which existed to prevent exactly this for an owner's private
 * content.
 */
import { CLERK_BOOTSTRAP_TIMEOUT_MS } from "~/composables/useClerkGatedFetch";

export function useViewerAuthResolved(isClerkLoaded: Ref<boolean>) {
  const clerkBootstrapTimedOut = ref(false);
  onMounted(() => {
    const timeoutId = setTimeout(() => {
      clerkBootstrapTimedOut.value = true;
    }, CLERK_BOOTSTRAP_TIMEOUT_MS);
    onUnmounted(() => clearTimeout(timeoutId));
  });

  const viewerAuthResolved = computed(
    () => isClerkLoaded.value || clerkBootstrapTimedOut.value,
  );

  return { viewerAuthResolved };
}
