<template>
  <!-- No click-outside dismissal: this is the only time the key is visible. -->
  <div
    class="api-key-dialog"
    role="dialog"
    aria-modal="true"
    aria-labelledby="api-key-dialog-title"
  >
    <div class="api-key-dialog__panel">
      <h3 id="api-key-dialog-title" class="display">Copy your API key</h3>
      <p>You won't be able to see this key again.</p>
      <code class="api-key-dialog__secret" data-testid="api-key-secret">{{
        secret
      }}</code>
      <p v-if="copyStatus" role="status">{{ copyStatus }}</p>
      <div class="api-key-dialog__actions">
        <button type="button" class="btn btn--outline btn--sm" @click="copyKey">
          copy
        </button>
        <button
          type="button"
          class="btn btn--primary btn--sm"
          @click="emit('close')"
        >
          done
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const COPY_SUCCESS_MESSAGE = "Copied.";
const COPY_FAILED_MESSAGE =
  "Couldn't copy. Select the key and copy it by hand.";

const props = defineProps<{ secret: string }>();
const emit = defineEmits<{ close: [] }>();

const copyStatus = ref<string | null>(null);

async function copyKey(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.secret);
    copyStatus.value = COPY_SUCCESS_MESSAGE;
  } catch {
    copyStatus.value = COPY_FAILED_MESSAGE;
  }
}
</script>

<style scoped>
.api-key-dialog {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.5);
}
.api-key-dialog__panel {
  width: 100%;
  max-width: 480px;
  padding: 26px;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
}
.api-key-dialog__panel h3 {
  margin-bottom: 8px;
  font-size: 18px;
}
.api-key-dialog__panel p {
  margin: 0 0 14px;
  font-size: 13px;
  color: var(--ink-2);
}
.api-key-dialog__secret {
  display: block;
  margin-bottom: 14px;
  padding: 10px 12px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  font-size: 12px;
  overflow-wrap: anywhere;
  user-select: all;
}
.api-key-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
