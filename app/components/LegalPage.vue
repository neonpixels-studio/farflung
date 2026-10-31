<template>
  <div>
    <nav class="mk-nav">
      <NuxtLink class="brand" to="/">
        <AppIcon name="compass" :size="26" class="brand__mark" />
        <span class="brand__name">far<b>flung</b></span>
      </NuxtLink>
      <div class="links">
        <NuxtLink to="/pricing">Plans</NuxtLink>
        <NuxtLink to="/contact">Contact</NuxtLink>
        <NuxtLink to="/login">Sign in</NuxtLink>
        <AppThemeToggle />
      </div>
    </nav>

    <main class="legal">
      <h1>{{ title }}</h1>
      <!-- @todo Remove this notice once counsel-reviewed copy replaces the draft. -->
      <p class="legal__notice">
        Draft. This page is being finalized and may change.
      </p>
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string }>();
</script>

<style scoped>
.mk-nav {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 16px clamp(20px, 5vw, 56px);
  border-bottom: 1px solid var(--line);
}
.links {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 22px;
  font-size: 12.5px;
  color: var(--ink-2);
}
.legal {
  max-width: 680px;
  margin: 0 auto;
  padding: 48px 20px 72px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--ink-2);
}
.legal h1 {
  font-size: clamp(30px, 5vw, 46px);
  font-weight: 700;
  letter-spacing: -0.03em;
  margin: 0 0 12px;
  color: var(--ink);
}
.legal__notice {
  padding-bottom: 20px;
  border-bottom: 1px solid var(--line);
}
.legal :deep(h2) {
  margin: 28px 0 8px;
  font-size: 18px;
  font-weight: 700;
  color: var(--ink);
}
.legal :deep(ul) {
  padding-left: 20px;
  list-style: disc;
}
</style>
