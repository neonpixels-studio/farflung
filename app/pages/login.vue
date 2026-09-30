<template>
  <div class="auth">
    <!-- LEFT: brand panel -->
    <div class="auth__brand">
      <div class="topo" />
      <span class="pin-float" style="left: 64%; top: 30%">
        <AppIcon name="pin" :size="26" class="pin" />
        <small>tokyo</small>
      </span>
      <span class="pin-float" style="left: 42%; top: 46%">
        <AppIcon name="pin" :size="20" class="pin" />
        <small>lisbon</small>
      </span>

      <div class="brand-top">
        <NuxtLink class="brand" to="/">
          <AppIcon name="compass" :size="26" class="brand__mark" />
          <span class="brand__name">wander<b>ist</b></span>
        </NuxtLink>
        <AppThemeToggle />
      </div>

      <div class="brand-mid">
        <div class="label">
          // {{ loginPlacesLabel }} places · {{ loginCountriesLabel }} countries
        </div>
        <h1 style="margin-top: 14px">Your map is<br /><b>waiting.</b></h1>
        <p>
          Pick up where you left off — every pin, journal entry and photo,
          exactly where you dropped it.
        </p>
        <div class="stamp">
          <div>
            <div class="k">Streak</div>
            <div class="v">{{ loginStreakLabel }}</div>
          </div>
          <div>
            <div class="k">{{ PLACEHOLDER_DISTANCE_LABEL }}</div>
            <div class="v">{{ loginDistanceValue }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- RIGHT: Clerk sign-in form -->
    <div class="auth__form">
      <div class="auth__form-inner">
        <div class="auth-corner">
          <AppThemeToggle />
        </div>
        <SignIn
          :fallback-redirect-url="safeRedirectPath"
          :sign-up-fallback-redirect-url="safeRedirectPath"
          :appearance="{
            variables: {
              colorPrimary: '#a855f7',
              colorBackground: 'var(--surface)',
              colorInputBackground: 'var(--surface-2)',
              colorInputText: 'var(--ink)',
              colorText: 'var(--ink)',
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              borderRadius: '7px',
            },
          }"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { formatCompact } from "~/utils/formatNumber";
import {
  AUTH_REDIRECT_QUERY_PARAM,
  getSafeRedirectPath,
} from "~/utils/authRedirect";

useHead({ title: "Wanderist — Sign in" });
definePageMeta({ layout: false });

// Every "sign in to ..." link across profile/trips carries the visitor's
// origin path via return_to (see buildLoginPath in utils/authRedirect); this
// validates it before ever handing it to Clerk so a crafted return_to can't
// turn sign-in into an open redirect (#292). return_to (not Clerk's own
// reserved redirect_url) is deliberate — see the constant's comment in
// utils/authRedirect for why reusing Clerk's name would bypass this
// validation entirely.
//
// Bound to both fallback-redirect-url (a visitor who already has an account)
// and sign-up-fallback-redirect-url (a visitor who doesn't, and signs up
// instead from the same embedded form) so either path lands back on the same
// destination. Both "fallback" props only apply when Clerk has no other
// redirect already in flight (e.g. an email verification link), so neither
// ever clobbers Clerk's own multi-step auth flows. `?? undefined` (not a bare
// null) so an unset param omits the prop entirely, rather than passing an
// explicit null that could override an app-level default Clerk is configured
// with elsewhere (env var / dashboard redirect settings).
const route = useRoute();
const safeRedirectPath = computed(
  () =>
    getSafeRedirectPath(route.query[AUTH_REDIRECT_QUERY_PARAM]) ?? undefined,
);

// Representative placeholder values for the marketing panel.
// Always displayed — the login page is public and should never reflect a
// previous user's real stats from the shared useState cache, which persists
// across client-side navigation after sign-out without a full page reload.
// The distance label is hardcoded to match the unit implied by the placeholder
// value (48218 mi) so the label and value always agree regardless of any
// cached preference from a prior user session.
const PLACEHOLDER_PLACES = 117;
const PLACEHOLDER_COUNTRIES = 9;
const PLACEHOLDER_STREAK = 14;
const PLACEHOLDER_DISTANCE = 48218;
const PLACEHOLDER_DISTANCE_LABEL = "Miles logged";

const loginPlacesLabel = formatCompact(PLACEHOLDER_PLACES);
const loginCountriesLabel = formatCompact(PLACEHOLDER_COUNTRIES);
const loginStreakLabel = `${PLACEHOLDER_STREAK} days`;
const loginDistanceValue = formatCompact(PLACEHOLDER_DISTANCE);
</script>

<style scoped>
.auth {
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  min-height: 100vh;
}

.auth__brand {
  position: relative;
  overflow: hidden;
  background: var(--bg-tint);
  border-right: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  padding: 40px 48px;
}
.auth__brand .topo {
  opacity: calc(var(--topo-opacity) * 1.8);
}

.brand-top {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.brand-mid {
  position: relative;
  z-index: 2;
  margin-top: auto;
}
.brand-mid h1 {
  font-size: clamp(32px, 4vw, 50px);
  line-height: 0.98;
  font-weight: 700;
  letter-spacing: -0.025em;
}
.brand-mid h1 b {
  color: var(--accent-ink);
}
.brand-mid p {
  max-width: 380px;
  margin: 18px 0 0;
  color: var(--ink-2);
  font-size: 14px;
  line-height: 1.65;
}

.stamp {
  position: relative;
  z-index: 2;
  margin-top: 34px;
  display: flex;
  gap: 26px;
  flex-wrap: wrap;
}
.stamp div .k {
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
}
.stamp div .v {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 600;
  margin-top: 3px;
}

.pin-float {
  position: absolute;
  z-index: 2;
}
.pin-float small {
  display: block;
  font-size: 9.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
  margin-top: 2px;
  padding-left: 2px;
}

.auth__form {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 40px clamp(28px, 7vw, 96px);
  position: relative;
}
.auth__form-inner {
  width: 100%;
  max-width: 420px;
  margin: 0 auto;
}
.auth-corner {
  position: absolute;
  top: 28px;
  right: 32px;
}

@media (max-width: 860px) {
  .auth {
    grid-template-columns: 1fr;
  }
  .auth__brand {
    min-height: 240px;
    padding: 26px;
  }
  .brand-mid h1 {
    font-size: 34px;
  }
  .stamp {
    display: none;
  }
  .auth__form {
    padding: 36px 22px;
  }
  .auth-corner {
    top: 22px;
    right: 22px;
  }
}
</style>
