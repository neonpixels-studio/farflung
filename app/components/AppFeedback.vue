<template>
  <div v-if="isSignedIn" class="feedback">
    <button
      ref="triggerRef"
      type="button"
      class="feedback__fab"
      aria-label="Send feedback"
      aria-haspopup="dialog"
      :aria-expanded="isOpen"
      @click="openDialog"
    >
      ?
    </button>

    <div
      v-if="isOpen"
      class="feedback__overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-title"
      @keydown.esc="closeDialog"
    >
      <div class="feedback__scrim" @click="closeDialog" />
      <div ref="panelRef" class="feedback__panel">
        <div class="feedback__head">
          <h2 id="feedback-title">Send feedback</h2>
          <button
            type="button"
            class="feedback__close"
            aria-label="Close feedback"
            @click="closeDialog"
          >
            <AppIcon name="x" :size="16" />
          </button>
        </div>

        <AppAlert
          v-if="status === 'success'"
          intent="success"
          title="Feedback sent"
          message="Thanks! We read every note."
        />
        <form v-else class="feedback__form" @submit.prevent="handleSubmit">
          <AppAlert
            v-if="status === 'error'"
            intent="error"
            title="Something went wrong"
            :message="errorMessage"
          />
          <InputText
            v-model="email"
            label="Email"
            name="email"
            type="email"
            autocomplete="email"
            required
            :disabled="isSubmitting"
          />
          <InputTextarea
            v-model="message"
            label="Message"
            name="message"
            placeholder="What's working, what isn't, what you wish it did…"
            :rows="5"
            required
            :disabled="isSubmitting"
          />
          <button
            type="submit"
            class="btn btn--primary btn--block"
            :disabled="isSubmitting"
          >
            {{ isSubmitting ? "sending…" : "send feedback" }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { extractErrorMessage } from "~/utils/extractErrorMessage";

type SubmitStatus = "idle" | "submitting" | "success" | "error";

const { isSignedIn } = useClerkAuth();
const { user } = useClerkUser();
const { apiFetch } = useApiClient();

const isOpen = ref(false);
const email = ref("");
const message = ref("");
const status = ref<SubmitStatus>("idle");
const errorMessage = ref("");
const triggerRef = ref<HTMLButtonElement | null>(null);
const panelRef = ref<HTMLElement | null>(null);

const isSubmitting = computed(() => status.value === "submitting");

function primaryEmail(): string {
  return user.value?.primaryEmailAddress?.emailAddress ?? "";
}

function openDialog(): void {
  if (status.value === "success") {
    message.value = "";
  }
  status.value = "idle";
  email.value = email.value || primaryEmail();
  isOpen.value = true;
  focusMessageField();
}

// InputTextarea forwards attrs to its <textarea> but exposes no ref, so reach
// it through the panel. Moving focus inside also lets Escape close the dialog.
async function focusMessageField(): Promise<void> {
  await nextTick();
  panelRef.value?.querySelector("textarea")?.focus();
}

function closeDialog(): void {
  isOpen.value = false;
  triggerRef.value?.focus();
}

async function handleSubmit(): Promise<void> {
  status.value = "submitting";

  try {
    await apiFetch("/api/feedback", {
      method: "POST",
      body: {
        message: message.value,
        email: email.value,
        url: window.location.href,
      },
    });
    status.value = "success";
  } catch (error) {
    errorMessage.value = extractErrorMessage(error);
    status.value = "error";
  }
}
</script>

<style scoped>
.feedback__fab {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 60;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
  box-shadow: var(--shadow-lg);
  cursor: pointer;
  transition: transform 0.15s;
}
.feedback__fab:hover {
  transform: scale(1.06);
}

.feedback__overlay {
  position: fixed;
  inset: 0;
  z-index: 95;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.feedback__scrim {
  position: absolute;
  inset: 0;
  background: rgba(20, 17, 14, 0.46);
  backdrop-filter: blur(2px);
}
.feedback__panel {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: 100%;
  max-width: 440px;
  padding: 22px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
}
.feedback__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.feedback__head h2 {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
}
.feedback__close {
  border: none;
  background: none;
  color: var(--ink-2);
  cursor: pointer;
}
.feedback__form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
</style>
