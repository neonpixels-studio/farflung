<template>
  <div>
    <MarketingNav />

    <!-- HEADER -->
    <header class="contact-head">
      <div class="topo topo--fade" />
      <div class="contact-head__in">
        <div class="label" style="justify-content: center">// contact</div>
        <h1>Say <b>hello.</b></h1>
        <p>
          Questions, feedback, or a trip story to share. We read everything.
        </p>
      </div>
    </header>

    <!-- FORM -->
    <section class="contact-body">
      <AppAlert
        v-if="status === 'success'"
        intent="success"
        title="Message sent"
        message="Thanks for reaching out. We'll get back to you soon."
      />
      <form
        v-else
        class="contact-form"
        :name="CONTACT_FORM_NAME"
        @submit.prevent="handleSubmit"
      >
        <AppAlert
          v-if="status === 'error'"
          intent="error"
          title="Something went wrong"
          message="Your message didn't send. Please try again."
        />
        <p class="honeypot" aria-hidden="true">
          <label>
            Leave this empty
            <input
              v-model="fields['bot-field']"
              name="bot-field"
              tabindex="-1"
              autocomplete="off"
            />
          </label>
        </p>
        <InputText
          v-model="fields.name"
          label="Name"
          name="name"
          autocomplete="name"
          required
          :disabled="isSubmitting"
        />
        <InputText
          v-model="fields.email"
          label="Email"
          name="email"
          type="email"
          autocomplete="email"
          required
          :disabled="isSubmitting"
        />
        <InputTextarea
          v-model="fields.message"
          label="Message"
          name="message"
          :rows="6"
          required
          :disabled="isSubmitting"
        />
        <button
          type="submit"
          class="btn btn--primary btn--block"
          :disabled="isSubmitting"
        >
          {{ isSubmitting ? "sending…" : "send message" }}
        </button>
      </form>
    </section>
    <MarketingFooter />
  </div>
</template>

<script setup lang="ts">
import { useOgMeta } from "~/composables/useOgMeta";
import {
  CONTACT_FORM_NAME,
  submitContactForm,
  type ContactFormFields,
} from "~/utils/contactForm";

type SubmitStatus = "idle" | "submitting" | "success" | "error";

useOgMeta(() => ({
  pageTitle: "Contact",
  description: "Get in touch with the FarFlung team.",
}));

const fields = reactive<ContactFormFields>({
  name: "",
  email: "",
  message: "",
  "bot-field": "",
});

const status = ref<SubmitStatus>("idle");
const isSubmitting = computed(() => status.value === "submitting");

async function handleSubmit() {
  status.value = "submitting";

  try {
    await submitContactForm({ ...fields });
    status.value = "success";
  } catch {
    status.value = "error";
  }
}
</script>

<style scoped>
.contact-head {
  text-align: center;
  padding: 48px 20px 26px;
  position: relative;
  overflow: hidden;
}
.contact-head .topo {
  opacity: calc(var(--topo-opacity) * 1.3);
}
.contact-head__in {
  position: relative;
  z-index: 2;
}
.contact-head h1 {
  font-size: clamp(30px, 5vw, 46px);
  font-weight: 700;
  letter-spacing: -0.03em;
  margin: 12px 0 12px;
}
.contact-head h1 b {
  color: var(--accent-ink);
}
.contact-head p {
  color: var(--ink-2);
  font-size: 14px;
  margin: 0 auto;
  max-width: 440px;
}

.contact-body {
  max-width: 520px;
  margin: 0 auto 70px;
  padding: 0 clamp(16px, 4vw, 24px);
}
.contact-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.honeypot {
  position: absolute;
  left: -9999px;
}
</style>
