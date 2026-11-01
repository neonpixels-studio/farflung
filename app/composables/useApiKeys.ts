/**
 * Composable for the /api/api-keys endpoints behind the settings page's API keys
 * section. The raw key from createKey is returned to the caller and deliberately
 * never kept in this state.
 */

import { useApiClient } from "~/composables/useApiClient";
import { extractErrorMessage } from "~/utils/extractErrorMessage";

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

export interface CreatedApiKey extends Omit<ApiKey, "lastUsedAt"> {
  key: string;
}

export interface CreateApiKeyInput {
  name: string;
  expiresInDays?: number;
}

export function useApiKeys() {
  const { apiFetch } = useApiClient();

  const apiKeys = ref<ApiKey[]>([]);
  const isLoading = ref(false);
  const loadError = ref<string | null>(null);
  const actionError = ref<string | null>(null);

  async function fetchApiKeys(): Promise<void> {
    isLoading.value = true;
    loadError.value = null;

    try {
      apiKeys.value = await apiFetch<ApiKey[]>("/api/api-keys");
    } catch (error: unknown) {
      loadError.value = extractErrorMessage(error);
    } finally {
      isLoading.value = false;
    }
  }

  async function createApiKey(
    input: CreateApiKeyInput,
  ): Promise<CreatedApiKey | null> {
    isLoading.value = true;
    actionError.value = null;

    try {
      const created = await apiFetch<CreatedApiKey>("/api/api-keys", {
        method: "POST",
        body: input,
      });
      const { key: _rawKey, ...listed } = created;
      apiKeys.value = [{ ...listed, lastUsedAt: null }, ...apiKeys.value];
      return created;
    } catch (error: unknown) {
      actionError.value = extractErrorMessage(error);
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  async function revokeApiKey(id: string): Promise<void> {
    isLoading.value = true;
    actionError.value = null;

    try {
      await apiFetch(`/api/api-keys/${id}`, { method: "DELETE" });
      apiKeys.value = apiKeys.value.filter((apiKey) => apiKey.id !== id);
    } catch (error: unknown) {
      actionError.value = extractErrorMessage(error);
    } finally {
      isLoading.value = false;
    }
  }

  return {
    apiKeys,
    isLoading,
    loadError,
    actionError,
    fetchApiKeys,
    createApiKey,
    revokeApiKey,
  };
}
