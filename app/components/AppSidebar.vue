<template>
  <aside class="sidebar" :class="{ 'is-open': isOpen }">
    <NuxtLink class="brand" to="/home">
      <AppIcon name="compass" :size="26" class="brand__mark" />
      <span class="brand__name">far<b>flung</b></span>
    </NuxtLink>

    <nav class="nav">
      <NuxtLink
        class="nav__item"
        :class="{ 'is-active': isActive('/home') }"
        to="/home"
        @click="close"
      >
        <AppIcon name="compass2" :size="17" />
        Home
      </NuxtLink>
      <NuxtLink
        class="nav__item"
        :class="{ 'is-active': isActive('/map') }"
        to="/map"
        @click="close"
      >
        <AppIcon name="map" :size="17" />
        Map
      </NuxtLink>
      <NuxtLink
        class="nav__item"
        :class="{ 'is-active': isActive('/journal') }"
        to="/journal"
        @click="close"
      >
        <AppIcon name="journal" :size="17" />
        Journal
      </NuxtLink>
      <NuxtLink
        class="nav__item"
        :class="{ 'is-active': isActive('/trips') }"
        to="/trips"
        @click="close"
      >
        <AppIcon name="route" :size="17" />
        Trips
      </NuxtLink>
      <NuxtLink
        class="nav__item"
        :class="{ 'is-active': isActive('/guides') }"
        to="/guides"
        @click="close"
      >
        <AppIcon name="layers" :size="17" />
        Guides
      </NuxtLink>
      <NuxtLink
        class="nav__item"
        :class="{ 'is-active': isActive('/explore') }"
        to="/explore"
        @click="close"
      >
        <AppIcon name="globe" :size="17" />
        Explore
      </NuxtLink>
      <div class="nav__sep" />
      <NuxtLink
        class="nav__item"
        :class="{ 'is-active': isActive('/settings') }"
        to="/settings"
        @click="close"
      >
        <AppIcon name="settings" :size="17" />
        Settings
      </NuxtLink>
    </nav>

    <div class="side-foot">
      <AppThemeToggle />
      <NuxtLink class="user-chip" to="/settings">
        <span v-if="user?.imageUrl" class="user-chip__av">
          <img :src="user.imageUrl" :alt="displayName" class="user-chip__av" />
        </span>
        <span
          v-else
          class="user-chip__av"
          style="display: grid; place-items: center; color: var(--accent-ink)"
        >
          <AppIcon name="user" :size="16" />
        </span>
        <span>
          <span class="user-chip__name">{{ displayName }}</span
          ><br />
          <span class="user-chip__mail">{{
            user?.primaryEmailAddress?.emailAddress
          }}</span>
        </span>
      </NuxtLink>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { resolveClerkDisplayName } from "~/utils/clerkDisplayName";

defineProps<{ isOpen: boolean }>();
const emit = defineEmits<{ close: [] }>();

const { user } = useClerkUser();
const route = useRoute();

// Path-based rather than the router's active class: /trips and /trips/:id are
// sibling routes, so the router wouldn't treat /trips as active on a trip page.
function isActive(path: string): boolean {
  return route.path === path || route.path.startsWith(`${path}/`);
}

const displayName = computed(() => resolveClerkDisplayName(user.value));

function close() {
  emit("close");
}
</script>
