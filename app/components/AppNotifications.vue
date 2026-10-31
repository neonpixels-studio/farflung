<template>
  <div
    v-if="open"
    ref="panelRef"
    class="notif is-open"
    :style="panelStyle"
    role="dialog"
    aria-label="Notifications"
  >
    <div class="notif__head">
      <b>Notifications</b>
      <button class="notif__mark" @click="handleMarkAllRead">
        mark all read
      </button>
    </div>
    <div ref="listRef" class="notif__list" tabindex="-1">
      <div v-if="isLoading && notifications.length === 0" class="notif__empty">
        Loading…
      </div>
      <!-- Only the empty-list case replaces the row area with the error
           state, mirroring /activity: once rows are showing, a later error
           (e.g. a failed dismiss) renders as a banner instead of a message
           masquerading as an empty state on top of a populated list. -->
      <div
        v-else-if="error && notifications.length === 0"
        class="notif__empty notif__empty--error"
        role="alert"
      >
        {{ error }}
      </div>
      <div
        v-if="error && notifications.length > 0"
        class="alert alert--error notif__error"
        role="alert"
      >
        {{ error }}
      </div>
      <NotificationDrawerItem
        v-for="notification in previewNotifications"
        :key="notification.id"
        :ref="(instance) => setItemRef(notification.id, instance)"
        :notification="notification"
        :dismissing="dismissingIds.has(notification.id)"
        @activate="handleItemClick"
        @dismiss="handleDismiss"
      />
    </div>
    <NuxtLink class="notif__foot" to="/activity">
      View all activity
      <AppIcon name="arrow-right" :size="14" />
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
// Vue APIs are Nuxt auto-imports (accessed as globals so tests can substitute
// them via vi.stubGlobal). Components/composables are imported explicitly.
import NotificationDrawerItem from "~/components/NotificationDrawerItem.vue";
import { useDismissFocusRestore } from "~/composables/useDismissFocusRestore";
import type { AppNotification } from "~/composables/useNotifications";

const props = defineProps<{
  open: boolean;
  // The bell button the panel hangs under. Clicks on it are left to its own
  // toggle handler so the outside-click close doesn't race it (close, reopen).
  anchor?: HTMLElement | null;
}>();
const emit = defineEmits<{ close: [] }>();

const PANEL_ANCHOR_GAP_PX = 8;
const VIEWPORT_EDGE_GAP_PX = 12;

const {
  notifications,
  isLoading,
  error,
  dismissingIds,
  fetchNotifications,
  markAllRead,
  markRead,
  dismissNotification,
} = useNotifications();

// The drawer is a quick preview; the full list lives on /activity (linked in
// the footer). The shared store can hold every page once /activity has walked
// it, so cap what the dropdown renders.
const DRAWER_PREVIEW_LIMIT = 12;
const previewNotifications = computed(() =>
  notifications.value.slice(0, DRAWER_PREVIEW_LIMIT),
);

// List-level fallback focus target when a dismiss empties the preview list.
const listRef = ref<HTMLElement | null>(null);
const { setItemRef, dismissWithFocusRestore } = useDismissFocusRestore(
  () => previewNotifications.value,
  listRef,
);

const panelRef = ref<HTMLElement | null>(null);
const panelStyle = ref<Record<string, string> | undefined>(undefined);

// Right-aligns the panel under the anchor, clamped so it never overflows the
// left edge on narrow viewports (max-width in CSS handles the rest).
function positionUnderAnchor(): void {
  if (!props.anchor) {
    panelStyle.value = undefined;
    return;
  }
  const anchorRect = props.anchor.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth;
  panelStyle.value = {
    top: `${anchorRect.bottom + PANEL_ANCHOR_GAP_PX}px`,
    right: `${Math.max(VIEWPORT_EDGE_GAP_PX, viewportWidth - anchorRect.right)}px`,
  };
}

// The click listener runs in the capture phase so the target is still attached
// when checked; a bubbling listener would miss clicks on rows that their own
// handler removes from the DOM (e.g. dismiss) and wrongly close the panel.
function isInsidePanelOrAnchor(event: Event): boolean {
  const eventPath = event.composedPath();
  return (
    (!!panelRef.value && eventPath.includes(panelRef.value)) ||
    (!!props.anchor && eventPath.includes(props.anchor))
  );
}

function handleDocumentClick(event: MouseEvent): void {
  if (isInsidePanelOrAnchor(event)) {
    return;
  }
  emit("close");
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  if (event.key !== "Escape") {
    return;
  }
  emit("close");
  props.anchor?.focus();
}

function removeDismissListeners(): void {
  document.removeEventListener("click", handleDocumentClick, true);
  document.removeEventListener("keydown", handleDocumentKeydown);
}

watch(
  () => props.open,
  (isOpen) => {
    removeDismissListeners();
    if (!isOpen) {
      return;
    }
    positionUnderAnchor();
    document.addEventListener("click", handleDocumentClick, true);
    document.addEventListener("keydown", handleDocumentKeydown);
  },
  { immediate: true },
);

onBeforeUnmount(removeDismissListeners);

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      fetchNotifications().catch((fetchError: unknown) => {
        console.error(
          "[AppNotifications] fetchNotifications failed",
          fetchError,
        );
      });
    }
  },
);

async function handleMarkAllRead(): Promise<void> {
  await markAllRead();
}

async function handleItemClick(notification: AppNotification): Promise<void> {
  if (notification.isRead) {
    return;
  }
  await markRead(notification.id);
}

// After a dismiss removes the focused row, moves keyboard focus to the
// adjacent dismiss button (or the list container as a last resort) instead
// of letting it fall back to <body>. See useDismissFocusRestore for the
// shared restore logic (also used by app/pages/activity.vue).
async function handleDismiss(notification: AppNotification): Promise<void> {
  await dismissWithFocusRestore(notification.id, () =>
    dismissNotification(notification.id),
  );
}
</script>
