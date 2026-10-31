import type { Ref } from "vue";
import { useApiClient } from "~/composables/useApiClient";
import { extractErrorMessage } from "~/utils/extractErrorMessage";
import {
  describeHandleProblem,
  findHandleProblem,
} from "../../server/utils/handle";

export type HandleCheckStatus =
  "idle" | "checking" | "available" | "unavailable" | "error";

export const HANDLE_CHECK_DEBOUNCE_MS = 400;

interface AvailabilityResponse {
  available: boolean;
  message: string | null;
}

/**
 * Live feedback for the public handle field. The format rules run locally and
 * instantly; only a well-formed, changed handle is sent to
 * GET /api/handles/<handle>/availability, debounced, with stale responses
 * discarded. The saved handle never counts as taken by its own owner. The
 * unique index on lower(handle) still decides on save; this is advisory.
 */
export function useHandleAvailability(
  handle: Ref<string>,
  savedHandle: Ref<string | null>,
) {
  const { apiFetch } = useApiClient();
  const status = ref<HandleCheckStatus>("idle");
  const message = ref<string | null>(null);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let requestId = 0;

  function clearTimer(): void {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  }

  function settle(
    nextStatus: HandleCheckStatus,
    nextMessage: string | null,
  ): void {
    status.value = nextStatus;
    message.value = nextMessage;
  }

  async function checkRemotely(candidate: string): Promise<void> {
    const thisRequestId = ++requestId;
    settle("checking", null);
    try {
      const result = await apiFetch<AvailabilityResponse>(
        `/api/handles/${encodeURIComponent(candidate)}/availability`,
      );
      if (thisRequestId !== requestId) {
        return;
      }
      settle(result.available ? "available" : "unavailable", result.message);
    } catch (error: unknown) {
      if (thisRequestId !== requestId) {
        return;
      }
      settle("error", extractErrorMessage(error));
    }
  }

  function evaluate(rawHandle: string): void {
    clearTimer();
    requestId += 1;
    const candidate = rawHandle.trim();

    if (candidate === "") {
      settle("idle", null);
      return;
    }
    const problem = findHandleProblem(candidate);
    if (problem) {
      settle("unavailable", describeHandleProblem(problem));
      return;
    }
    if (candidate.toLowerCase() === savedHandle.value?.toLowerCase()) {
      settle("idle", null);
      return;
    }
    settle("checking", null);
    debounceTimer = setTimeout(
      () => checkRemotely(candidate),
      HANDLE_CHECK_DEBOUNCE_MS,
    );
  }

  watch(handle, evaluate);
  onBeforeUnmount(clearTimer);

  return { status, message };
}
