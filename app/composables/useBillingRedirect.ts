import { useApiClient } from "~/composables/useApiClient";
import { extractErrorMessage } from "~/utils/extractErrorMessage";

/**
 * Billing routes need the Clerk Bearer token, which a full-page navigation
 * can't send, so they return the Stripe URL and the browser goes there after.
 */
export function useBillingRedirect() {
  const { apiFetch } = useApiClient();
  const isRedirecting = ref(false);
  const redirectError = ref<string | null>(null);

  async function redirectToBilling(path: string): Promise<void> {
    isRedirecting.value = true;
    redirectError.value = null;
    try {
      const { url } = await apiFetch<{ url: string }>(path);
      window.location.href = url;
    } catch (error) {
      redirectError.value = extractErrorMessage(error);
      isRedirecting.value = false;
    }
  }

  return { isRedirecting, redirectError, redirectToBilling };
}
