<template>
  <LegalPage title="Terms of Service">
    <!-- @todo Replace with reviewed copy: legal entity, governing law, liability, refunds. -->
    <h2>Your account</h2>
    <p>
      You are responsible for your account and for what happens under it. Keep
      your sign-in details secure.
    </p>

    <h2>Your content</h2>
    <p>
      You own what you add to FarFlung. You give us permission to store and
      display it so the service can work, including to others when you choose to
      publish it. Only add content you have the right to share.
    </p>

    <h2>Paid plans</h2>
    <p>
      Paid plans renew automatically until canceled. When you cancel, your plan
      stays active until the end of the paid period. Stripe processes payments.
    </p>

    <h2>Acceptable use</h2>
    <p>
      Don't use FarFlung to break the law, harm others or interfere with the
      service. We may suspend accounts that do.
    </p>

    <h2>Contact</h2>
    <p>
      Questions about these terms? Reach us through the
      <NuxtLink to="/contact">contact page</NuxtLink>.
    </p>
  </LegalPage>
</template>

<script setup lang="ts">
useHead({ title: "FarFlung — Terms of Service" });
</script>
