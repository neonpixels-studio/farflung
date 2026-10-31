<template>
  <button
    type="button"
    :disabled="isRedirecting"
    v-bind="$attrs"
    @click="redirectToBilling('/api/billing/portal')"
  >
    <slot />
  </button>
  <p v-if="redirectError" class="plan-action-error" role="alert">
    {{ redirectError }}
  </p>
</template>

<script setup lang="ts">
/**
 * Sends the browser to a Stripe Billing Portal session to view invoices,
 * update their payment method, or cancel.
 *
 * Only rendered by callers once the user already has a paid-tier
 * subscription row (see app/pages/settings.vue), so there is no
 * "unconfigured" state to handle here the way PlanCheckoutButton has to.
 */
import { useBillingRedirect } from "~/composables/useBillingRedirect";

defineOptions({ inheritAttrs: false });

const { isRedirecting, redirectError, redirectToBilling } =
  useBillingRedirect();
</script>
