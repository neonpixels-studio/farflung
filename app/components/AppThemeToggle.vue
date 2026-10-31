<template>
  <div class="theme-toggle">
    <button
      :class="{ 'is-active': theme === 'light' }"
      aria-label="Light theme"
      :aria-pressed="theme === 'light'"
      @click="setTheme('light')"
    >
      <AppIcon name="sun" :size="14" />
    </button>
    <button
      :class="{ 'is-active': theme === 'dark' }"
      aria-label="Dark theme"
      :aria-pressed="theme === 'dark'"
      @click="setTheme('dark')"
    >
      <AppIcon name="moon" :size="14" />
    </button>
    <button
      :class="{ 'is-active': theme === 'system' }"
      aria-label="System theme"
      :aria-pressed="theme === 'system'"
      @click="setTheme('system')"
    >
      <AppIcon name="sliders" :size="14" />
    </button>
  </div>
</template>

<script setup lang="ts">
const { theme, setTheme } = useTheme();
</script>
