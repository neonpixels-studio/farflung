<template>
  <li class="api-key-row">
    <div class="api-key-row__meta">
      <b>{{ apiKey.name }}</b>
      <code>ff_{{ apiKey.prefix }}…</code>
      <p>
        Created {{ formatDate(apiKey.createdAt) }} · Last used
        {{ apiKey.lastUsedAt ? formatDate(apiKey.lastUsedAt) : "never" }}
        <template v-if="apiKey.expiresAt">
          · Expires {{ formatDate(apiKey.expiresAt) }}
        </template>
      </p>
    </div>
    <button
      type="button"
      class="btn btn--ghost btn--sm"
      :disabled="disabled"
      @click="emit('revoke')"
    >
      {{ confirming ? "confirm revoke" : "revoke" }}
    </button>
  </li>
</template>

<script setup lang="ts">
import type { ApiKey } from "~/composables/useApiKeys";

defineProps<{ apiKey: ApiKey; disabled: boolean; confirming: boolean }>();
const emit = defineEmits<{ revoke: [] }>();

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
</script>

<style scoped>
.api-key-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
  border-bottom: 1px dashed var(--line);
}
.api-key-row:last-child {
  border-bottom: none;
}
.api-key-row__meta b {
  margin-right: 8px;
  font-size: 13px;
  font-weight: 600;
}
.api-key-row__meta code {
  font-size: 11.5px;
  color: var(--ink-2);
}
.api-key-row__meta p {
  margin: 3px 0 0;
  font-size: 11.5px;
  color: var(--muted);
}
</style>
