<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <AppFeedback />
  </div>
</template>

<script setup lang="ts">
useTheme();
</script>
