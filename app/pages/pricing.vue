<template>
  <div>
    <!-- NAV -->
    <nav class="mk-nav">
      <NuxtLink class="brand" to="/">
        <AppIcon name="compass" :size="26" class="brand__mark" />
        <span class="brand__name">wander<b>ist</b></span>
      </NuxtLink>
      <div class="links">
        <NuxtLink to="/home">Product</NuxtLink>
        <NuxtLink to="/pricing">Plans</NuxtLink>
        <NuxtLink to="/login">Sign in</NuxtLink>
        <AppThemeToggle />
      </div>
    </nav>

    <!-- HEADER -->
    <header class="cmp-head" data-reveal>
      <div class="topo topo--fade" />
      <div class="cmp-head__in">
        <div class="label" style="justify-content: center">
          // compare plans
        </div>
        <h1>Every feature,<br /><b>side by side.</b></h1>
        <p>Find the plan that fits how you travel. Switch or cancel anytime.</p>
        <div class="billing">
          <button
            :class="{ 'is-active': cycle === 'monthly' }"
            @click="cycle = 'monthly'"
          >
            Monthly
          </button>
          <button
            :class="{ 'is-active': cycle === 'yearly' }"
            @click="cycle = 'yearly'"
          >
            Yearly <span class="save">−25%</span>
          </button>
        </div>
      </div>
    </header>

    <!-- TABLE -->
    <div class="table-wrap" data-reveal>
      <table class="cmp">
        <thead>
          <tr>
            <th class="thd thd--feat">
              <span class="thd__name">Features</span>
            </th>
            <th class="thd">
              <div class="thd__name">Drifter</div>
              <div class="thd__price">
                $0<span class="thd__per">/forever</span>
              </div>
              <div class="thd__cta">
                <NuxtLink
                  :to="freeTierCtaTarget"
                  class="btn btn--outline btn--sm btn--block"
                  >start</NuxtLink
                >
              </div>
            </th>
            <th class="thd thd--pop">
              <div class="thd__name accent-text">Wanderer</div>
              <div class="thd__price">
                {{ wandererPrice }}<span class="thd__per">{{ perLabel }}</span>
              </div>
              <div class="thd__cta">
                <PlanCheckoutButton
                  v-if="isSignedIn"
                  tier="wanderer"
                  :cycle="cycle"
                  class="btn btn--primary btn--sm btn--block"
                  >free trial</PlanCheckoutButton
                >
                <NuxtLink
                  v-else
                  to="/login"
                  class="btn btn--primary btn--sm btn--block"
                  >free trial</NuxtLink
                >
              </div>
            </th>
            <th class="thd">
              <div class="thd__name">Nomad</div>
              <div class="thd__price">
                {{ nomadPrice }}<span class="thd__per">{{ perLabel }}</span>
              </div>
              <div class="thd__cta">
                <PlanCheckoutButton
                  v-if="isSignedIn"
                  tier="nomad"
                  :cycle="cycle"
                  class="btn btn--outline btn--sm btn--block"
                  >free trial</PlanCheckoutButton
                >
                <NuxtLink
                  v-else
                  to="/login"
                  class="btn btn--outline btn--sm btn--block"
                  >free trial</NuxtLink
                >
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr class="cat-row">
            <td colspan="4">Places &amp; trips</td>
          </tr>
          <tr class="feat-row">
            <td>Places pinned</td>
            <td>25</td>
            <td class="pop">Unlimited</td>
            <td>Unlimited</td>
          </tr>
          <tr class="feat-row">
            <td>Active trips</td>
            <td>1</td>
            <td class="pop">Unlimited</td>
            <td>Unlimited</td>
          </tr>
          <tr class="feat-row">
            <td>Journal entries</td>
            <td><CheckIcon /></td>
            <td class="pop"><CheckIcon /></td>
            <td><CheckIcon /></td>
          </tr>
          <tr class="feat-row">
            <td>GPX route import / export</td>
            <td><DashCell /></td>
            <td class="pop"><DashCell /></td>
            <td><CheckIcon /></td>
          </tr>

          <tr class="cat-row">
            <td colspan="4">Photos &amp; media</td>
          </tr>
          <tr class="feat-row">
            <td>Photo storage</td>
            <td>100</td>
            <td class="pop">Unlimited</td>
            <td>Unlimited</td>
          </tr>
          <tr class="feat-row">
            <td>Instagram sync</td>
            <td><DashCell /></td>
            <td class="pop"><CheckIcon /></td>
            <td><CheckIcon /></td>
          </tr>
          <tr class="feat-row">
            <td>Original-resolution backup</td>
            <td><DashCell /></td>
            <td class="pop"><DashCell /></td>
            <td><CheckIcon /></td>
          </tr>

          <tr class="cat-row">
            <td colspan="4">Maps</td>
          </tr>
          <tr class="feat-row">
            <td>Map styles</td>
            <td>1</td>
            <td class="pop">All</td>
            <td>All</td>
          </tr>
          <tr class="feat-row">
            <td>Offline maps</td>
            <td><DashCell /></td>
            <td class="pop"><CheckIcon /></td>
            <td><CheckIcon /></td>
          </tr>
          <tr class="feat-row">
            <td>Year-in-review &amp; stats</td>
            <td><DashCell /></td>
            <td class="pop"><CheckIcon /></td>
            <td><CheckIcon /></td>
          </tr>

          <tr class="cat-row">
            <td colspan="4">Sharing &amp; support</td>
          </tr>
          <tr class="feat-row">
            <td>Public traveler profile</td>
            <td><DashCell /></td>
            <td class="pop"><DashCell /></td>
            <td><CheckIcon /></td>
          </tr>
          <tr class="feat-row">
            <td>Collaborative trips</td>
            <td><DashCell /></td>
            <td class="pop"><DashCell /></td>
            <td><CheckIcon /></td>
          </tr>
          <tr class="feat-row">
            <td>Support</td>
            <td>Community</td>
            <td class="pop">Email</td>
            <td>Priority</td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="tfoot-cta">
            <td />
            <td>
              <NuxtLink :to="freeTierCtaTarget" class="btn btn--outline btn--sm"
                >get started</NuxtLink
              >
            </td>
            <td class="pop">
              <PlanCheckoutButton
                v-if="isSignedIn"
                tier="wanderer"
                :cycle="cycle"
                class="btn btn--primary btn--sm"
                >start free trial</PlanCheckoutButton
              >
              <NuxtLink v-else to="/login" class="btn btn--primary btn--sm"
                >start free trial</NuxtLink
              >
            </td>
            <td>
              <PlanCheckoutButton
                v-if="isSignedIn"
                tier="nomad"
                :cycle="cycle"
                class="btn btn--outline btn--sm"
                >start free trial</PlanCheckoutButton
              >
              <NuxtLink v-else to="/login" class="btn btn--outline btn--sm"
                >start free trial</NuxtLink
              >
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
/* eslint-disable vue/one-component-per-file */
useHead({ title: "FarFlung — Compare plans" });
useScrollReveal();

const { isSignedIn } = useClerkAuth();

// Signed-in visitors already have an account — "start"/"get started" on the
// free Drifter tier sends them straight into the app rather than back to login.
const freeTierCtaTarget = computed(() =>
  isSignedIn.value ? "/home" : "/login",
);

const cycle = ref<"monthly" | "yearly">("monthly");

const wandererPrice = computed(() => (cycle.value === "yearly" ? "$6" : "$8"));
const nomadPrice = computed(() => (cycle.value === "yearly" ? "$12" : "$16"));
const perLabel = computed(() => (cycle.value === "yearly" ? "/mo·yr" : "/mo"));

const CheckIcon = defineComponent({
  setup() {
    return () =>
      h(
        "svg",
        {
          class: "ck",
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": "2.2",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          style: "display:inline-block;vertical-align:middle",
        },
        [h("polyline", { points: "20 6 9 17 4 12" })],
      );
  },
});

const DashCell = defineComponent({
  setup() {
    return () => h("span", { class: "dash" }, "—");
  },
});
</script>

<style scoped>
.mk-nav {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 16px clamp(20px, 5vw, 56px);
  border-bottom: 1px solid var(--line);
  background: color-mix(in srgb, var(--bg) 84%, transparent);
  backdrop-filter: blur(10px);
}
.links {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 22px;
  font-size: 12.5px;
  color: var(--ink-2);
}
.links a:hover {
  color: var(--accent-ink);
}

.cmp-head {
  text-align: center;
  padding: 48px 20px 26px;
  position: relative;
  overflow: hidden;
}
.cmp-head .topo {
  opacity: calc(var(--topo-opacity) * 1.3);
}
.cmp-head__in {
  position: relative;
  z-index: 2;
}
.cmp-head h1 {
  font-size: clamp(30px, 5vw, 46px);
  font-weight: 700;
  letter-spacing: -0.03em;
  margin: 12px 0 12px;
}
.cmp-head h1 b {
  color: var(--accent-ink);
}
.cmp-head p {
  color: var(--ink-2);
  font-size: 14px;
  margin: 0 auto 22px;
  max-width: 440px;
}

.billing {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--line-strong);
  border-radius: 99px;
  background: var(--surface-2);
}
.billing button {
  padding: 7px 16px;
  border: none;
  background: none;
  border-radius: 99px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--muted);
}
.billing button.is-active {
  background: var(--accent-weak);
  color: var(--accent-ink);
  font-weight: 600;
}
.save {
  margin-left: 6px;
  font-size: 9.5px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--success-ink);
  background: var(--success-weak);
  padding: 2px 7px;
  border-radius: 99px;
}

.table-wrap {
  max-width: 1000px;
  margin: 0 auto 70px;
  padding: 0 clamp(16px, 4vw, 24px);
}
table.cmp {
  width: 100%;
  border-collapse: collapse;
}
table.cmp thead th {
  position: sticky;
  top: 65px;
  z-index: 20;
  background: var(--bg);
}
.thd {
  padding: 16px 14px 18px;
  vertical-align: bottom;
  text-align: center;
  border-bottom: 1px solid var(--line-strong);
}
.thd--feat {
  text-align: left;
  width: 38%;
}
.thd--pop {
  background: var(--accent-weak);
  border-radius: 12px 12px 0 0;
}
.thd__name {
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 600;
}
.thd__price {
  font-family: var(--font-display);
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-top: 4px;
}
.thd__per {
  font-size: 11px;
  color: var(--muted);
  font-weight: 400;
  font-family: var(--font-mono);
}
.thd__cta {
  margin-top: 12px;
}
.thd--feat .thd__name {
  font-size: 13px;
  color: var(--muted);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.cat-row td {
  padding: 22px 14px 10px;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent-ink);
}
tbody tr.feat-row td {
  padding: 13px 14px;
  border-bottom: 1px dashed var(--line);
  font-size: 12.5px;
  text-align: center;
  color: var(--ink-2);
}
tbody tr.feat-row td:first-child {
  text-align: left;
  color: var(--ink);
  font-weight: 500;
}
tbody tr.feat-row td.pop {
  background: color-mix(in srgb, var(--accent-weak) 55%, transparent);
}
.ck {
  color: var(--accent);
  width: 17px;
  height: 17px;
}
.dash {
  color: var(--faint);
}
.tfoot-cta td {
  padding: 18px 14px;
  text-align: center;
}
.tfoot-cta td.pop {
  background: var(--accent-weak);
  border-radius: 0 0 12px 12px;
}

@media (max-width: 760px) {
  .thd__price {
    font-size: 20px;
  }
  .thd {
    padding: 12px 6px;
  }
  tbody tr.feat-row td,
  .cat-row td {
    font-size: 11px;
    padding: 10px 6px;
  }
  .thd__cta .btn {
    padding: 7px 8px;
    font-size: 11px;
  }
}
</style>
