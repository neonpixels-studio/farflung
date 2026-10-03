/**
 * Manages the current user's follow state.
 *
 * - followingIds: reactive set of Clerk user IDs the current user follows
 * - fetchFollowing: loads persisted follow state from the server on demand
 * - toggleFollow: follow or unfollow a user by their Clerk user ID, keeping
 *   local state in sync with the persisted result
 * - isFollowing: returns true if the current user follows the given user ID
 * - pendingUserIds: set of user IDs currently being toggled (per-user guard)
 *
 * Both sets are global and viewer-scoped, so they reset whenever the signed-in
 * user ends their session or changes to a different user. Without this a
 * still-mounted consumer would keep rendering the previous viewer's follows.
 * Must be called synchronously during setup (it calls useClerkUser()).
 */
export function useFollows() {
  const { apiFetch } = useApiClient();
  const { user } = useClerkUser();

  const followingIds = useState<Set<string>>(
    "follows:followingIds",
    () => new Set(),
  );
  // pendingUserIds is global (useState) so the in-flight dedup guard holds
  // across multiple components using useFollows() simultaneously (e.g. a
  // follow button in a profile card and on the explore page).
  const pendingUserIds = useState<Set<string>>(
    "follows:pendingUserIds",
    () => new Set(),
  );
  // error is local (ref) rather than global because it is contextual to the
  // component that triggered the action. Different components should display
  // their own error state independently.
  const error = ref<string | null>(null);

  // Only reset when a previously signed-in viewer is replaced (sign-out or user
  // switch). The initial undefined -> user transition on Clerk load is skipped
  // so it can't clobber a fetch that already landed.
  watch(
    () => user.value?.id,
    (currentUserId, previousUserId) => {
      if (!previousUserId || currentUserId === previousUserId) {
        return;
      }
      followingIds.value = new Set();
      pendingUserIds.value = new Set();
    },
    { flush: "sync" },
  );

  // A request that outlives its viewer must not write that viewer's data into
  // the state of whoever is signed in (or out) by the time it settles.
  function isSameViewer(requestViewerId: string | undefined): boolean {
    return user.value?.id === requestViewerId;
  }

  async function fetchFollowing(): Promise<void> {
    const requestViewerId = user.value?.id;
    error.value = null;
    try {
      const response = await apiFetch<{ followingIds: string[] }>(
        "/api/follows",
      );
      if (!isSameViewer(requestViewerId)) {
        return;
      }
      // Skip the overwrite if a toggle is mid-flight. The toggle's optimistic
      // update is the source of truth; a server snapshot that raced ahead of
      // the toggle commit would otherwise clobber the just-changed local state.
      if (pendingUserIds.value.size > 0) {
        return;
      }
      followingIds.value = new Set(response.followingIds);
    } catch (fetchError) {
      console.error("useFollows: failed to load following list", fetchError);
      error.value = "Could not load following list";
    }
  }

  async function follow(userId: string): Promise<void> {
    const requestViewerId = user.value?.id;
    await apiFetch("/api/follows", {
      method: "POST",
      body: { followeeId: userId },
    });
    if (!isSameViewer(requestViewerId)) {
      return;
    }
    followingIds.value = new Set([...followingIds.value, userId]);
  }

  async function unfollow(userId: string): Promise<void> {
    const requestViewerId = user.value?.id;
    await apiFetch(`/api/follows/${encodeURIComponent(userId)}`, {
      method: "DELETE",
    });
    if (!isSameViewer(requestViewerId)) {
      return;
    }
    const updated = new Set(followingIds.value);
    updated.delete(userId);
    followingIds.value = updated;
  }

  function releasePending(
    userId: string,
    requestViewerId: string | undefined,
  ): void {
    if (!isSameViewer(requestViewerId)) {
      return;
    }
    const next = new Set(pendingUserIds.value);
    next.delete(userId);
    pendingUserIds.value = next;
  }

  async function toggleFollow(userId: string): Promise<void> {
    if (pendingUserIds.value.has(userId)) {
      return;
    }

    const requestViewerId = user.value?.id;
    pendingUserIds.value = new Set([...pendingUserIds.value, userId]);
    error.value = null;

    try {
      if (followingIds.value.has(userId)) {
        await unfollow(userId);
      } else {
        await follow(userId);
      }
    } catch (toggleError) {
      console.error("useFollows: toggleFollow failed", toggleError);
      error.value = "Could not update follow state";
    } finally {
      releasePending(userId, requestViewerId);
    }
  }

  function isFollowing(userId: string): boolean {
    return followingIds.value.has(userId);
  }

  function isPending(userId: string): boolean {
    return pendingUserIds.value.has(userId);
  }

  return {
    followingIds,
    pendingUserIds,
    error,
    fetchFollowing,
    toggleFollow,
    isFollowing,
    isPending,
  };
}
