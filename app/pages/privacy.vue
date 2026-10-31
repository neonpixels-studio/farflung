<template>
  <LegalPage title="Privacy Policy">
    <!-- @todo Replace with reviewed copy: legal entity, jurisdiction, retention periods, user rights. -->
    <h2>What we collect</h2>
    <ul>
      <li>Your account details, such as your name and email address.</li>
      <li>What you add: places, trips, journal entries, guides and photos.</li>
      <li>Your plan and subscription status.</li>
      <li>Usage and error data that helps us run and improve the service.</li>
    </ul>

    <h2>Who processes it</h2>
    <ul>
      <li>Clerk handles sign-in and account management.</li>
      <li>Stripe handles payments. We do not store your card details.</li>
      <li>Neon hosts our database, and Netlify hosts the app and uploads.</li>
      <li>Mapbox provides maps.</li>
      <li>Sentry records errors, and Google Analytics measures usage.</li>
      <li>Google signs you in if you choose to use your Google account.</li>
      <li>Instagram supplies your photos only if you connect your account.</li>
    </ul>

    <h2>Your choices</h2>
    <p>
      You control what you publish, and you can disconnect Google or Instagram
      or delete your account from Settings. Deleted accounts are permanently
      removed after 14 days.
    </p>

    <h2>Contact</h2>
    <p>
      Questions about your data? Reach us through the
      <NuxtLink to="/contact">contact page</NuxtLink>.
    </p>
  </LegalPage>
</template>

<script setup lang="ts">
import { useOgMeta } from "~/composables/useOgMeta";
useOgMeta(() => ({
  pageTitle: "Privacy Policy",
  description: "How FarFlung collects, uses and protects your data.",
}));
</script>
