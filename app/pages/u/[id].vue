<template>
  <div class="content">
    <AppTopbar title="Profile" crumb="Travelers">
      <button
        class="icon-btn"
        aria-label="Search"
        @click="openCommandPalette?.()"
      >
        <AppIcon name="search" :size="18" />
      </button>
    </AppTopbar>

    <div v-if="isLoading" class="profile-state" aria-busy="true">
      Loading profile…
    </div>

    <div v-else-if="notFound" class="profile-state">
      <h2>Profile unavailable</h2>
      <p>This traveler doesn’t exist or keeps their profile private.</p>
      <NuxtLink class="btn btn--outline btn--sm" to="/explore">
        <AppIcon name="arrow-right" :size="14" />
        back to Explore
      </NuxtLink>
      <!-- Removing the auth middleware (#279) means the profile's own owner,
           browsing signed out (an expired session, a fresh browser), can now
           land here too — this profile-state branch fires whenever the fetch
           looked anonymous or didn't match, not only for a genuine stranger
           or a nonexistent id, so the copy below stays neutral rather than
           presuming ownership. Mirrors trips/[id].vue and guides/[id].vue's
           identical not-found sign-in affordance, gated on viewerAuthResolved
           (not raw isClerkLoaded) so it still appears once the bootstrap
           timeout lapses, not only once Clerk actually resolves. -->
      <NuxtLink
        v-if="viewerAuthResolved && !isSignedIn"
        :to="signInHref"
        class="btn btn--outline btn--sm"
      >
        sign in to view this profile
      </NuxtLink>
    </div>

    <AppAlert v-else-if="error" intent="error" :message="error" />

    <template v-else-if="profile">
      <ProfileHeader
        :display-name="displayName"
        :handle-label="handleLabel"
        :home-base="profile.homeBase"
        :is-self="profile.isSelf"
        :following="viewerIsFollowingTarget"
        :pending="pending"
        :viewer-is-signed-in="!!isSignedIn"
        :viewer-auth-loaded="viewerAuthResolved"
        :sign-in-href="signInHref"
        @toggle="onToggleFollow"
      />

      <AppAlert
        v-if="followError"
        intent="error"
        :message="followError"
        :dismissible="true"
      />

      <p v-if="profile.bio" class="pbio">{{ profile.bio }}</p>

      <div class="pstats">
        <div class="pstat">
          <b>{{ profile.followerCount }}</b>
          <span>followers</span>
        </div>
        <div class="pstat">
          <b>{{ profile.followingCount }}</b>
          <span>following</span>
        </div>
        <div class="pstat">
          <b>{{ profile.placeCount }}</b>
          <span>places</span>
        </div>
      </div>

      <section class="psec">
        <div class="sec-head">
          <div>
            <div class="label">// followers</div>
            <h2>Who follows {{ displayName }}</h2>
          </div>
        </div>
        <ProfileFollowerList
          :followers="followers"
          :loading="followersLoading"
          :error-message="followersError"
          :has-more="hasMoreFollowers"
        />
      </section>

      <section class="psec">
        <div class="sec-head">
          <div>
            <div class="label">// following</div>
            <h2>Who {{ displayName }} follows</h2>
          </div>
        </div>
        <ProfileFollowingList
          :following="following"
          :loading="followingLoading"
          :error-message="followingError"
          :has-more="hasMoreFollowing"
        />
      </section>

      <section class="psec">
        <div class="sec-head">
          <div>
            <div class="label">// trips</div>
            <h2>{{ displayName }}’s public trips</h2>
          </div>
        </div>
        <ProfileTripList
          :trips="trips"
          :loading="tripsLoading"
          :error-message="tripsError"
          :has-more="hasMoreTrips"
        />
      </section>

      <section class="psec">
        <div class="sec-head">
          <div>
            <div class="label">// guides</div>
            <h2>{{ displayName }}’s public guides</h2>
          </div>
        </div>
        <ProfileGuideList
          :guides="guides"
          :loading="guidesLoading"
          :error-message="guidesError"
          :has-more="hasMoreGuides"
        />
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { DEFAULT_TRAVELER_NAME, formatHandle } from "~/utils/travelerLabels";
import { buildLoginPath } from "~/utils/authRedirect";
import { SITE_NAME, useOgMeta } from "~/composables/useOgMeta";
import { useClerkGatedFetch } from "~/composables/useClerkGatedFetch";
import { useViewerAuthResolved } from "~/composables/useViewerAuthResolved";
import { isValidHandle } from "../../../server/utils/handle";

const openCommandPalette = inject<(() => void) | undefined>(
  "openCommandPalette",
  undefined,
);

// No auth middleware: a public profile must open for anonymous visitors
// following a shared link, instead of being redirected to /login before the
// page (and its og/twitter meta, see useOgMeta below) ever renders (#279).
// This mirrors trips/[id].vue and guides/[id].vue. The GET endpoints
// (/api/users/[id] and its followers/following/trips/guides sub-resources)
// enforce visibility — a private profile 404s for anyone but its owner, it
// never redirects to /login — so a private profile stays protected.
// Owner-only affordances (follow/unfollow) are meaningless for the profile
// owner viewing their own page and simply reflect `profile.isSelf` from the
// API response.
//
// This one page serves two routes: /u/<id> and /@<handle> (the second is
// registered in nuxt.config.ts via addHandleProfileRoute). A /u/<id> visit
// redirects to /@<handle> once the profile loads and has a usable handle; the
// id URL otherwise keeps working.
definePageMeta({ layout: "app" });

const route = useRoute();
const handleParam = computed(() =>
  typeof route.params.handle === "string" ? route.params.handle : null,
);
const routeUserId = computed(() => String(route.params.id));
// What the current URL names: the handle on /@<handle>, the id on /u/<id>.
const lookupKey = computed(() => handleParam.value ?? routeUserId.value);
// Carries this profile's URL through /login so a visitor who signs in to
// follow (or to view a private profile) lands back here afterward (#292).
const signInHref = computed(() => buildLoginPath(route.fullPath));

const {
  profile: rawProfile,
  followers,
  hasMoreFollowers,
  following,
  hasMoreFollowing,
  trips,
  hasMoreTrips,
  guides,
  hasMoreGuides,
  isLoading: rawIsLoading,
  followersLoading,
  followingLoading,
  tripsLoading,
  guidesLoading,
  notFound: rawNotFound,
  error,
  followersError,
  followingError,
  tripsError,
  guidesError,
  fetchProfile,
  fetchProfileByHandle,
  fetchFollowers,
  fetchFollowingList,
  fetchTrips,
  fetchGuides,
} = useProfile();

const {
  fetchFollowing,
  toggleFollow,
  isFollowing,
  isPending,
  error: followError,
} = useFollows();

// isLoaded gates when the profile fetch below is allowed to fire with a real
// token (see the useClerkGatedFetch usage further down); isSignedIn drives
// canRetryAuthenticated so a session that resolves after the first (possibly
// anonymous) fetch re-issues it, same as trips/[id].vue and guides/[id].vue.
const { isLoaded: isClerkLoaded, isSignedIn } = useClerkAuth();
const canRetryAuthenticated = computed(
  () => isClerkLoaded.value && !!isSignedIn.value,
);
const { gate: gateOnClerkLoad, retryGeneration } = useClerkGatedFetch(
  isClerkLoaded,
  canRetryAuthenticated,
);

// The fetch below gives up waiting on Clerk after CLERK_BOOTSTRAP_TIMEOUT_MS
// and loads the public profile anonymously anyway (see useClerkGatedFetch),
// so a page can be fully rendered while isClerkLoaded is still false forever
// (Clerk's script blocked by an ad blocker, a flaky CDN). Gating the follow
// button / sign-in prompts on raw isClerkLoaded alone would leave that viewer
// at a permanent dead end on an otherwise-working page — mirror the fetch's
// own bounded wait here so the prompts resolve on the same timeout instead.
const { viewerAuthResolved } = useViewerAuthResolved(isClerkLoaded);

// Guards against the render window during in-page navigation (u/A -> u/B):
// the route id updates reactively before the fetch replaces `rawProfile`
// (now a `useState`-backed, single shared slot — see useProfile.ts — rather
// than a fresh ref per mount, so it can otherwise briefly hold the previous
// traveler's data under the new URL), so only show the loaded profile once
// it actually matches the id in the URL. Mirrors guides/[id].vue's `guide`
// and trips/[id].vue's `tripDetail` guards.
//
// On /@<handle> the id isn't in the URL, so "matches" means the loaded profile
// carries that handle (case-insensitively, as handles are).
function matchesRoute(candidate: {
  userId: string;
  handle: string | null;
}): boolean {
  if (handleParam.value !== null) {
    return candidate.handle?.toLowerCase() === handleParam.value.toLowerCase();
  }
  return candidate.userId === routeUserId.value;
}

const profile = computed(() =>
  rawProfile.value && matchesRoute(rawProfile.value) ? rawProfile.value : null,
);

// The profile owner's id: from the URL on /u/<id>, from the loaded profile on
// /@<handle> (empty until it resolves).
const userId = computed(() =>
  handleParam.value !== null
    ? (profile.value?.userId ?? "")
    : routeUserId.value,
);

// notFound (from useProfile) is a plain alias, not a guarded computed: it's
// already reset synchronously at the top of every fetchProfile() call (see
// useProfile.ts), before any await, so it can't carry A's stale value into a
// fetch already in flight for B the way `rawProfile` can.
const notFound = rawNotFound;

// isLoading intentionally overrides useProfile's own `rawIsLoading` with two
// more reasons to keep showing the loading state rather than committing to a
// (possibly wrong) rendered outcome:
//
// - A profile switch (u/A -> u/B): the route id updates reactively before
//   fetchProfile(B) actually clears rawIsLoading/rawNotFound for it (that
//   refetch fires from a watch, not synchronously with the id change) — so
//   without this, that one-tick gap could render nothing (profile guarded to
//   null above, but isLoading/notFound/error still A's stale settled values)
//   instead of a loading state.
// - The SSR-then-not-found case (#289, see the useAsyncData call below):
//   withhold "Profile unavailable" until the viewer's own auth has resolved,
//   so an owner's private profile doesn't flash not-found before their
//   authenticated retry lands (would otherwise regress #255).
function computeIsLoading(): boolean {
  if (rawIsLoading.value) {
    return true;
  }
  if (rawProfile.value && !matchesRoute(rawProfile.value)) {
    return true;
  }
  if (rawNotFound.value && !viewerAuthResolved.value) {
    return true;
  }
  return false;
}
const isLoading = computed(computeIsLoading);

const displayName = computed(
  () =>
    profile.value?.displayName ??
    profile.value?.handle ??
    DEFAULT_TRAVELER_NAME,
);

const handleLabel = computed(() => formatHandle(profile.value?.handle));

// Whether the viewer (not the profile owner) follows this profile — distinct
// from `following`, the profile owner's own list of who they follow.
const viewerIsFollowingTarget = computed(() => isFollowing(userId.value));
const pending = computed(() => isPending(userId.value));

// Falls back to a stats summary when the traveler hasn't written a bio (or
// the bio is only whitespace), so a share-link preview never shows a blank
// description.
const profileDescription = computed(() => {
  if (!profile.value) {
    return `A traveler's profile on ${SITE_NAME}.`;
  }
  if (profile.value.bio?.trim()) {
    return profile.value.bio;
  }
  const followerLabel = `${profile.value.followerCount} ${profile.value.followerCount === 1 ? "follower" : "followers"}`;
  const placeLabel = `${profile.value.placeCount} ${profile.value.placeCount === 1 ? "place" : "places"}`;
  return `${displayName.value} on ${SITE_NAME} — ${followerLabel}, ${placeLabel}.`;
});

useOgMeta(() => ({
  pageTitle: profile.value ? displayName.value : "Profile",
  description: profileDescription.value,
}));

async function onToggleFollow(): Promise<void> {
  // Capture the target once: the viewer can navigate to another profile while
  // the toggle is in flight (follower rows link to /u/[id]), so re-reading
  // userId after the await would adjust the wrong profile's count.
  const targetUserId = userId.value;
  const wasFollowing = isFollowing(targetUserId);
  await toggleFollow(targetUserId);
  // Bail if the viewer navigated away mid-toggle. profile.value can still hold
  // the previous traveler (fetchProfile doesn't clear it until the new request
  // resolves), so check the live route param too — not just the loaded profile.
  if (userId.value !== targetUserId || profile.value?.userId !== targetUserId) {
    return;
  }
  // Keep the displayed follower count in step with the button after a
  // successful toggle (isFollowing reflects the committed state).
  const nowFollowing = isFollowing(targetUserId);
  if (nowFollowing === wasFollowing) {
    return;
  }
  profile.value.followerCount += nowFollowing ? 1 : -1;
  // The viewer just joined/left this profile's followers, so the list below is
  // now stale — refetch it to keep the list consistent with the count.
  await fetchFollowers(targetUserId);
}

// `server: true`: also runs during SSR, so a non-JS crawler following a
// shared link sees the traveler's real name/bio — including useOgMeta's
// og:title/og:description below — instead of the generic fallback (#289).
// Safe server-side: see useClerkGatedFetch's import.meta.server fast-path for
// why this is always an anonymous, non-blocking fetch there. `profile` and
// the four list states are `useState` (see useProfile.ts), not plain refs,
// specifically so this SSR-fetched data survives hydration instead of
// resetting, and so an anonymous visitor's browser never duplicates the
// request the server already made.
//
// Client-side, still gated on Clerk's bootstrap (#255) so a signed-in
// viewer's first *client* request already carries a token rather than
// re-reading anonymously first — but the SSR pass above always fetches
// anonymously regardless (Clerk's server middleware is disabled fleet-wide,
// see useClerkGatedFetch), so a private profile's own owner can still see an
// anonymous "not found" baked into the initial HTML until the authenticated
// client retry lands. `isLoading` below deliberately keeps showing the
// loading state (never a premature "Profile unavailable") through that
// window rather than trusting the SSR pass's not-found outcome outright.
// Watches retryGeneration too so a session resolving (or clearing) after the
// first fetch re-issues it with the new auth state, not just on route-param
// (profile-to-profile) navigation.
function fetchListsFor(targetUserId: string): Promise<unknown> {
  return Promise.all([
    fetchFollowers(targetUserId),
    fetchFollowingList(targetUserId),
    fetchTrips(targetUserId),
    fetchGuides(targetUserId),
  ]);
}

function fetchProfileById(targetUserId: string): Promise<unknown> {
  return Promise.all([fetchProfile(targetUserId), fetchListsFor(targetUserId)]);
}

// The lists are keyed by id, so on /@<handle> the profile has to resolve first.
// A 404 (unknown handle or private profile) leaves `profile` null and stops
// here, so nothing else is requested for it.
async function fetchProfileByHandleName(handle: string): Promise<void> {
  await fetchProfileByHandle(handle);
  if (!profile.value) {
    return;
  }
  await fetchListsFor(profile.value.userId);
}

function fetchProfileDetail(): Promise<true> {
  return gateOnClerkLoad(() =>
    handleParam.value !== null
      ? fetchProfileByHandleName(handleParam.value)
      : fetchProfileById(routeUserId.value),
  );
}

useAsyncData(() => `profile-${lookupKey.value}`, fetchProfileDetail, {
  server: true,
  watch: [lookupKey, retryGeneration],
});

// Moves /u/<id> visitors onto the canonical /@<handle> URL. Client-side and
// replace-style, so Back doesn't bounce; a handle that isn't a well-formed
// public handle (e.g. one saved before the format rules) is left on /u/<id>.
watch(
  profile,
  (loadedProfile) => {
    if (handleParam.value !== null || !loadedProfile?.handle) {
      return;
    }
    if (!isValidHandle(loadedProfile.handle)) {
      return;
    }
    navigateTo(`/@${encodeURIComponent(loadedProfile.handle)}`, {
      replace: true,
    });
  },
  { immediate: true },
);

// Follow state depends on the session token, so it is client-only too. The
// other fetches above get that from `server: false` on useAsyncData, but a
// bare `watch` has no such option, and Vue's `immediate: true` does invoke
// its callback during SSR component setup. Registering the watch itself
// inside onMounted (rather than a bare top-level watch) is what keeps this
// off the server: onMounted never runs during SSR, full stop, so nothing here
// depends on Clerk merely reporting unloaded there. Wait for
// canRetryAuthenticated (not a bare fetchFollowing() call) so an anonymous
// visitor following a shared profile link never fires this: /api/follows
// always requires a token, so a tokenless request would 401 and surface a
// spurious "Could not load following list" error banner (#279). `immediate:
// true` still fetches right away for a viewer whose session is already
// resolved by mount; a viewer who signs in afterward fetches once that
// resolves.
onMounted(() => {
  watch(
    canRetryAuthenticated,
    (viewerIsAuthenticated) => {
      if (!viewerIsAuthenticated) {
        return;
      }
      fetchFollowing();
    },
    { immediate: true },
  );
});
</script>

<style scoped>
.profile-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--ink-2);
}
.profile-state h2 {
  font-family: var(--font-display);
  font-size: 20px;
  margin-bottom: 8px;
}
.profile-state p {
  font-size: 13px;
  color: var(--muted);
  margin-bottom: 18px;
}

.pbio {
  font-size: 13.5px;
  color: var(--ink-2);
  margin: 16px 2px 0;
  line-height: 1.5;
}

.pstats {
  display: flex;
  gap: 26px;
  margin: 18px 2px 8px;
}
.pstat b {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 700;
}
.pstat span {
  font-size: 11px;
  color: var(--muted);
  margin-left: 5px;
}

.psec {
  margin-top: 26px;
}
.sec-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin: 0 0 14px;
}
.sec-head h2 {
  font-family: var(--font-display);
  font-size: 18px;
}
.sec-head .label {
  margin-bottom: 6px;
}
</style>
