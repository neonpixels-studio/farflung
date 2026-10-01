<template>
  <div class="nf-wrap">
    <div class="nf-top">
      <NuxtLink class="brand" to="/">
        <AppIcon name="compass" :size="22" class="brand__mark" />
        <span class="brand__name">wander<b>ist</b></span>
      </NuxtLink>
      <AppThemeToggle />
    </div>

    <main class="nf">
      <div class="topo" />
      <div class="nf__inner">
        <div class="label" style="justify-content: center; margin-bottom: 18px">
          // error {{ error?.statusCode ?? 404 }} — uncharted
        </div>
        <div class="nf__code">
          <span>4</span>
          <span class="nf__o">
            <AppIcon name="pin" :size="null" class="pin" />
          </span>
          <span>4</span>
          <svg
            class="route-svg"
            viewBox="0 0 420 40"
            fill="none"
            preserveAspectRatio="none"
          >
            <path
              d="M4 30 C 90 6, 150 34, 230 18 S 360 6, 416 22"
              stroke="currentColor"
              stroke-width="2"
              stroke-dasharray="3 7"
              stroke-linecap="round"
            />
          </svg>
        </div>
        <div class="nf__hint">· you are here ·</div>
        <h1>This place isn't on the map.</h1>
        <p>
          The page you're looking for wandered off — or never existed. Let's get
          you back to familiar ground.
        </p>
        <div class="nf__cta">
          <NuxtLink class="btn btn--primary btn--lg" to="/home">
            <AppIcon name="compass2" :size="18" />
            back to home base
          </NuxtLink>
          <button class="btn btn--outline btn--lg" @click="handleError">
            <AppIcon name="arrow-left" :size="18" />
            go back
          </button>
        </div>
        <div class="nf__coords">lat 0.0000 · lng 0.0000 · no signal</div>
      </div>
    </main>

    <div class="nf-foot">farflung · © 2026</div>
  </div>
</template>

<script setup lang="ts">
import type { NuxtError } from "#app";

defineProps<{ error: NuxtError | null }>();

function handleError() {
  clearError({ redirect: "/home" });
}
</script>

<style scoped>
.nf-wrap {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.nf-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22px clamp(20px, 5vw, 48px);
  position: relative;
  z-index: 3;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
}
.brand__mark {
  color: var(--accent-ink);
}
.brand__name {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 18px;
  color: var(--ink);
}
.brand__name b {
  color: var(--accent-ink);
}

.nf {
  position: relative;
  flex: 1;
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: 20px;
}
.nf .topo {
  opacity: calc(var(--topo-opacity, 0.08) * 1.7);
}
.nf__inner {
  position: relative;
  z-index: 2;
  text-align: center;
  max-width: 540px;
}
.nf__code {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(96px, 20vw, 200px);
  line-height: 0.9;
  letter-spacing: -0.04em;
  color: var(--ink);
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.04em;
}
.nf__o {
  width: 0.72em;
  height: 0.72em;
  border-radius: 50%;
  background: var(--accent);
  display: inline-grid;
  place-items: center;
  box-shadow: 0 14px 40px -10px
    color-mix(in srgb, var(--accent) 70%, transparent);
}
.nf__o .pin {
  color: #fff;
}
.nf__o :deep(.ico) {
  width: 0.4em;
  height: 0.4em;
}
html[data-theme="dark"] .nf__o .pin {
  color: #15101e;
}
.nf__hint {
  display: block;
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
  margin-top: 6px;
}
.nf h1 {
  font-size: clamp(24px, 4vw, 34px);
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 14px 0 10px;
}
.nf p {
  color: var(--ink-2);
  font-size: 14px;
  line-height: 1.6;
  margin: 0 auto 26px;
  max-width: 420px;
}
.nf__cta {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}
.nf__coords {
  margin-top: 30px;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--faint);
}
.route-svg {
  position: absolute;
  left: 50%;
  bottom: -26px;
  transform: translateX(-50%);
  width: min(420px, 80%);
  height: 40px;
  color: var(--accent);
  opacity: 0.5;
}

.nf-foot {
  text-align: center;
  padding: 22px;
  font-size: 11px;
  color: var(--faint);
  letter-spacing: 0.08em;
}
</style>
