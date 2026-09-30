<template>
  <article class="post">
    <div class="post__head">
      <span class="post__av">
        <AppIcon name="user" :size="18" />
      </span>
      <div class="post__who">
        <b>Me</b>
        <div class="post__meta">
          <AppIcon name="pin" :size="11" />
          {{ entryTimestamp }}
        </div>
      </div>
      <button
        class="post__edit icon-btn"
        style="border: none; margin-left: auto"
        aria-label="Edit entry"
        @click="emit('edit', entry)"
      >
        <AppIcon name="edit" :size="15" />
      </button>
      <button
        class="post__menu icon-btn"
        style="border: none"
        aria-label="More"
      >
        <AppIcon name="chevron" :size="16" style="transform: rotate(90deg)" />
      </button>
    </div>

    <div
      v-if="entry.photos.length > 0"
      :class="photoLayoutClass"
      class="post__media"
    >
      <div v-for="(photo, index) in visiblePhotos" :key="photo.id" class="ph">
        <div class="topo" style="opacity: 0.4" />
        <span
          v-if="
            index === visiblePhotos.length - 1 &&
            entry.photos.length > MAX_VISIBLE_PHOTOS
          "
          class="more-badge"
        >
          +{{ entry.photos.length - MAX_VISIBLE_PHOTOS }}
        </span>
      </div>
    </div>

    <div class="post__body">
      <div class="post__actions">
        <button
          class="like"
          :class="{ liked: isLiked }"
          :aria-label="isLiked ? 'Unlike entry' : 'Like entry'"
          @click="emit('toggle-like', entry)"
        >
          <AppIcon name="heart" :size="17" />
          <span class="cnt">{{ entry.likeCount }}</span>
        </button>
        <button aria-label="Comments">
          <AppIcon name="journal" :size="17" />
        </button>
        <button style="margin-left: auto" aria-label="Bookmark">
          <AppIcon name="star" :size="17" />
        </button>
      </div>
      <h3 class="post__title">{{ entry.title }}</h3>
      <p v-if="entry.body" class="post__text">{{ entry.body }}</p>
      <div v-if="entry.tags.length > 0" class="tag-row">
        <button
          v-for="(tag, index) in entry.tags"
          :key="tag.id"
          type="button"
          class="tag tag--clickable"
          :class="{ 'tag--accent': index === 0 }"
          :aria-label="`Filter entries by tag ${tag.name}`"
          @click="emit('filter-tag', tag)"
        >
          {{ tag.name }}
        </button>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Entry, EntryTag } from "~/stores/entries";

const MAX_VISIBLE_PHOTOS = 3;

const props = withDefaults(
  defineProps<{
    entry: Entry;
    isLiked?: boolean;
  }>(),
  { isLiked: false },
);

const emit = defineEmits<{
  "toggle-like": [entry: Entry];
  // The journal feed only ever renders the current user's own entries (GET
  // /api/entries is scoped to the caller), so the edit affordance is always for
  // an editable entry.
  edit: [entry: Entry];
  // Clicking a tag on the card filters the journal feed to that tag (see
  // app/pages/journal.vue).
  "filter-tag": [tag: EntryTag];
}>();

const visiblePhotos = computed(() =>
  props.entry.photos.slice(0, MAX_VISIBLE_PHOTOS),
);

const photoLayoutClass = computed(() =>
  props.entry.photos.length === 1 ? "single" : "grid",
);

const entryTimestamp = computed(() => {
  const dateSource = props.entry.occurredAt ?? props.entry.createdAt;
  const date = new Date(dateSource);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
});
</script>

<style scoped>
/* Tags render as <button> so they're clickable (filter the feed to that tag)
   but must keep the same look as the plain-span .tag style in main.css. */
.tag--clickable {
  font-family: inherit;
  cursor: pointer;
}
.tag--clickable:hover {
  border-color: var(--accent-line);
  color: var(--accent-ink);
}
</style>
