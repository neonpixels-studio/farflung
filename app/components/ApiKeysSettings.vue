<template>
  <div class="api-keys">
    <AppAlert v-if="loadError" intent="error" :title="loadError" />
    <AppAlert v-if="actionError" intent="error" :title="actionError" />

    <form class="api-keys__form" @submit.prevent="handleCreate">
      <InputText
        v-model="name"
        label="Key name"
        placeholder="Backfill script"
        autocomplete="off"
        :state="nameError ? 'error' : 'default'"
        :hint="nameError ?? undefined"
      />
      <InputText
        v-model="expiresInDays"
        label="Expires in (days)"
        type="number"
        placeholder="Never"
        autocomplete="off"
        :state="expiryError ? 'error' : 'default'"
        :hint="expiryError ?? undefined"
      />
      <button
        type="submit"
        class="btn btn--primary btn--sm"
        :disabled="isLoading"
      >
        <AppIcon name="plus" :size="14" />
        create key
      </button>
    </form>

    <p v-if="apiKeys.length === 0" class="api-keys__empty">No API keys yet.</p>
    <ul v-else class="api-keys__list">
      <ApiKeyRow
        v-for="apiKey in apiKeys"
        :key="apiKey.id"
        :api-key="apiKey"
        :disabled="isLoading"
        :confirming="pendingRevokeId === apiKey.id"
        @revoke="handleRevoke(apiKey.id)"
      />
    </ul>

    <ApiKeyCreatedDialog
      v-if="createdKey"
      :secret="createdKey"
      @close="createdKey = null"
    />
  </div>
</template>

<script setup lang="ts">
import { useApiKeys } from "~/composables/useApiKeys";

const NAME_REQUIRED_MESSAGE = "Name is required";
const EXPIRY_INVALID_MESSAGE = "Enter a whole number of days";

const {
  apiKeys,
  isLoading,
  loadError,
  actionError,
  fetchApiKeys,
  createApiKey,
  revokeApiKey,
} = useApiKeys();

const name = ref("");
const expiresInDays = ref("");
const nameError = ref<string | null>(null);
const expiryError = ref<string | null>(null);
const createdKey = ref<string | null>(null);
const pendingRevokeId = ref<string | null>(null);

onMounted(fetchApiKeys);

function validateForm(): boolean {
  const days = Number(expiresInDays.value);
  nameError.value = name.value.trim() ? null : NAME_REQUIRED_MESSAGE;
  expiryError.value =
    !expiresInDays.value || (Number.isInteger(days) && days >= 1)
      ? null
      : EXPIRY_INVALID_MESSAGE;
  return !nameError.value && !expiryError.value;
}

async function handleCreate(): Promise<void> {
  if (!validateForm()) {
    return;
  }

  const created = await createApiKey({
    name: name.value.trim(),
    ...(expiresInDays.value && { expiresInDays: Number(expiresInDays.value) }),
  });
  if (!created) {
    return;
  }

  createdKey.value = created.key;
  name.value = "";
  expiresInDays.value = "";
}

async function handleRevoke(id: string): Promise<void> {
  if (pendingRevokeId.value !== id) {
    pendingRevokeId.value = id;
    return;
  }

  pendingRevokeId.value = null;
  await revokeApiKey(id);
}
</script>

<style scoped>
.api-keys {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.api-keys__form {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px;
}
.api-keys__form > :not(button) {
  flex: 1 1 180px;
}
.api-keys__empty {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
}
.api-keys__list {
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
