<template>
  <nav class="mk-nav" :class="{ 'is-stuck': navStuck }">
    <NuxtLink class="brand" to="/">
      <AppIcon name="compass" :size="26" class="brand__mark" />
      <span class="brand__name">far<b>flung</b></span>
    </NuxtLink>
    <div class="mk-nav__links">
      <NuxtLink class="nl" to="/#features">Features</NuxtLink>
      <NuxtLink class="nl" to="/#how">How it works</NuxtLink>
      <NuxtLink class="nl" to="/#plans">Plans</NuxtLink>
      <NuxtLink v-if="isSignedIn" class="nl" to="/home">Dashboard</NuxtLink>
      <NuxtLink v-else class="nl" to="/login">Sign in</NuxtLink>
      <AppThemeToggle />
      <NuxtLink
        v-if="!isSignedIn"
        class="btn btn--primary btn--sm"
        to="/sign-up"
        external
        >start free</NuxtLink
      >
      <NuxtLink
        v-else-if="upgradeAction === 'pricing'"
        class="btn btn--primary btn--sm"
        to="/pricing"
        >upgrade</NuxtLink
      >
      <PlanManageButton
        v-else-if="upgradeAction === 'portal'"
        class="btn btn--primary btn--sm"
        >upgrade</PlanManageButton
      >
    </div>
  </nav>
</template>

<script setup lang="ts">
import { useUpgradeAction } from "~/composables/useUpgradeAction";

const { isSignedIn } = useClerkAuth();
const { upgradeAction } = useUpgradeAction();

const navStuck = ref(false);

function handleScroll(): void {
  navStuck.value = window.scrollY > 8;
}

onMounted(() => {
  window.addEventListener("scroll", handleScroll, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener("scroll", handleScroll);
});
</script>

<style scoped>
.mk-nav {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 14px clamp(20px, 5vw, 56px);
  border-bottom: 1px solid transparent;
  transition:
    border-color 0.2s,
    background 0.2s;
}
.mk-nav.is-stuck {
  border-color: var(--line);
  background: color-mix(in srgb, var(--bg) 84%, transparent);
  backdrop-filter: blur(12px);
}
.mk-nav__links {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 26px;
  font-size: 12.5px;
  color: var(--ink-2);
}
.mk-nav__links .nl {
  transition: color 0.14s;
}
.mk-nav__links .nl:hover {
  color: var(--accent-ink);
}
@media (max-width: 760px) {
  .mk-nav__links .nl {
    display: none;
  }
}
</style>
