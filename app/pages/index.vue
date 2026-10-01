<template>
  <div>
    <!-- ============ NAV ============ -->
    <nav id="mk-nav" class="mk-nav" :class="{ 'is-stuck': navStuck }">
      <NuxtLink class="brand" to="/">
        <AppIcon name="compass" :size="26" class="brand__mark" />
        <span class="brand__name">wander<b>ist</b></span>
      </NuxtLink>
      <div class="mk-nav__links">
        <a class="nl" href="#features">Features</a>
        <a class="nl" href="#how">How it works</a>
        <a class="nl" href="#plans">Plans</a>
        <NuxtLink class="nl" to="/login">Sign in</NuxtLink>
        <AppThemeToggle />
        <NuxtLink class="btn btn--primary btn--sm" to="/login"
          >start free</NuxtLink
        >
      </div>
    </nav>

    <!-- ============ HERO A ============ -->
    <header class="lp-hero lp-hero--a">
      <div class="lp in">
        <div class="lp-hero__copy" data-reveal-stagger data-reveal-step="70">
          <div class="label">// travel journal &amp; map · for nomads</div>
          <h1>Every place you've been,<br />on one <b>living map.</b></h1>
          <p class="lp-hero__sub">
            FarFlung is the journal and map for people who never quite stop
            moving. Drop a pin, write the moment, surface the hidden spots worth
            the detour — your whole world, quietly filling in.
          </p>
          <form class="lp-capture" novalidate @submit.prevent="handleCapture">
            <span class="lp-capture__pill">
              <AppIcon name="mail" :size="16" />
              <input
                v-model="email"
                type="email"
                placeholder="you@domain.com"
                aria-label="Email address"
                autocomplete="email"
              />
            </span>
            <button class="btn btn--primary btn--lg" type="submit">
              start free
              <AppIcon name="arrow-right" :size="15" />
            </button>
          </form>
          <p class="lp-capture__note">
            <AppIcon name="check" :size="13" />
            Free forever plan · no card needed
          </p>
        </div>
        <div class="hero-map" data-reveal>
          <div class="topo" />
          <span class="hero-chip" style="left: 6%; top: 13%">
            <span class="dot"><AppIcon name="globe" :size="12" /></span>
            <span><b>9</b> countries</span>
          </span>
          <span class="hero-chip" style="right: 7%; bottom: 15%">
            <span class="dot"><AppIcon name="pin" :size="12" /></span>
            <span><b>117</b> places pinned</span>
          </span>
          <NuxtLink class="pin-abs" to="/login" style="left: 26%; top: 42%">
            <AppIcon name="pin" :size="26" class="pin" />
            <span class="pin-tip">Reykjavík · 4 entries</span>
          </NuxtLink>
          <NuxtLink class="pin-abs sm" to="/login" style="left: 48%; top: 34%">
            <AppIcon name="pin" :size="18" class="pin" />
            <span class="pin-tip">London</span>
          </NuxtLink>
          <NuxtLink class="pin-abs sm" to="/login" style="left: 45%; top: 55%">
            <AppIcon name="pin" :size="18" class="pin" />
            <span class="pin-tip">Lisbon · 12 photos</span>
          </NuxtLink>
          <NuxtLink class="pin-abs sm" to="/login" style="left: 72%; top: 46%">
            <AppIcon name="pin" :size="18" class="pin" />
            <span class="pin-tip">Tokyo</span>
          </NuxtLink>
          <NuxtLink class="pin-abs sm" to="/login" style="left: 82%; top: 66%">
            <AppIcon name="pin" :size="18" class="pin" />
            <span class="pin-tip">Bali</span>
          </NuxtLink>
          <NuxtLink class="pin-abs sm" to="/login" style="left: 31%; top: 66%">
            <AppIcon name="pin" :size="18" class="pin" />
            <span class="pin-tip">Marrakech</span>
          </NuxtLink>
        </div>
      </div>
    </header>

    <!-- ============ FEATURES ============ -->
    <section id="features" class="lp-sec">
      <div class="lp">
        <div class="sec-head" data-reveal>
          <div class="label">// 01 — features</div>
          <h2>Everything a moving life <b>needs to remember.</b></h2>
          <p>
            Four quiet tools that turn scattered trips into one connected map of
            where you've been — and where you should go next.
          </p>
        </div>
        <div class="feat-grid" data-reveal-stagger data-reveal-step="90">
          <div class="feat">
            <div class="feat__ico"><AppIcon name="pin" :size="21" /></div>
            <h3>Drop a pin anywhere</h3>
            <p>
              Mark the café, the trailhead, the apartment you'd come back to.
              Every spot lands on your private world map.
            </p>
          </div>
          <div class="feat">
            <div class="feat__ico"><AppIcon name="journal" :size="21" /></div>
            <h3>Journal the moment</h3>
            <p>
              Write the entry while it's fresh, attach photos, tag who you were
              with. Searchable for as long as you wander.
            </p>
          </div>
          <div class="feat">
            <div class="feat__ico"><AppIcon name="route" :size="21" /></div>
            <h3>Plan multi-stop trips</h3>
            <p>
              Sketch a route across cities and countries, track what you've
              logged, and always know your next stop.
            </p>
          </div>
          <div class="feat">
            <div class="feat__ico"><AppIcon name="instagram" :size="21" /></div>
            <h3>Auto-import photos</h3>
            <p>
              Connect your camera roll and Instagram — geotagged shots flow
              straight onto the right place on the map.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ MAP SHOWCASE ============ -->
    <section id="map" class="lp-sec lp-sec--tint">
      <div class="lp">
        <div class="sec-head center" data-reveal>
          <div class="label">// 02 — your world</div>
          <h2>Everywhere you've been, <b>in one view.</b></h2>
          <p>
            Zoom out and see the shape of your travels — countries collected,
            routes drawn, the clusters where you keep returning.
          </p>
        </div>
        <div class="show-map" data-reveal>
          <div class="topo" />
          <NuxtLink class="pin-abs" to="/login" style="left: 22%; top: 40%">
            <AppIcon name="pin" :size="26" class="pin" />
            <span class="pin-tip">Reykjavík · 4 entries</span>
          </NuxtLink>
          <NuxtLink class="pin-abs sm" to="/login" style="left: 38%; top: 30%">
            <AppIcon name="pin" :size="18" class="pin" />
            <span class="pin-tip">London</span>
          </NuxtLink>
          <NuxtLink class="pin-abs sm" to="/login" style="left: 42%; top: 33%">
            <AppIcon name="pin" :size="18" class="pin" />
            <span class="pin-tip">Berlin</span>
          </NuxtLink>
          <NuxtLink class="pin-abs sm" to="/login" style="left: 40%; top: 52%">
            <AppIcon name="pin" :size="18" class="pin" />
            <span class="pin-tip">Lisbon · 12 photos</span>
          </NuxtLink>
          <NuxtLink class="pin-abs" to="/login" style="left: 70%; top: 42%">
            <AppIcon name="pin" :size="26" class="pin" />
            <span class="pin-tip">Tokyo · 8 entries</span>
          </NuxtLink>
          <NuxtLink class="pin-abs sm" to="/login" style="left: 78%; top: 60%">
            <AppIcon name="pin" :size="18" class="pin" />
            <span class="pin-tip">Bali</span>
          </NuxtLink>
          <NuxtLink class="pin-abs sm" to="/login" style="left: 84%; top: 72%">
            <AppIcon name="pin" :size="18" class="pin" />
            <span class="pin-tip">Sydney</span>
          </NuxtLink>
          <NuxtLink class="pin-abs sm" to="/login" style="left: 28%; top: 64%">
            <AppIcon name="pin" :size="18" class="pin" />
            <span class="pin-tip">Marrakech</span>
          </NuxtLink>
          <div class="show-map__legend">
            <span class="tag tag--accent">117 pins</span>
            <span class="tag">9 countries</span>
            <span class="tag">48,210 mi</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ HOW IT WORKS ============ -->
    <section id="how" class="lp-sec">
      <div class="lp">
        <div class="sec-head" data-reveal>
          <div class="label">// 03 — how it works</div>
          <h2>Three taps from <b>here to remembered.</b></h2>
        </div>
        <div class="steps" data-reveal-stagger data-reveal-step="120">
          <div class="step">
            <div class="step__n">STEP 01</div>
            <div class="step__ico"><AppIcon name="pin" :size="22" /></div>
            <h3>Pin it</h3>
            <p>
              Tap the map or import a geotagged photo. The place is saved with
              its exact coordinates and date.
            </p>
          </div>
          <div class="step">
            <div class="step__n">STEP 02</div>
            <div class="step__ico"><AppIcon name="journal" :size="22" /></div>
            <h3>Write it</h3>
            <p>
              Add a note, a rating, the hidden detail you'll want to remember —
              or the reason you'd send a friend.
            </p>
          </div>
          <div class="step">
            <div class="step__n">STEP 03</div>
            <div class="step__ico"><AppIcon name="globe" :size="22" /></div>
            <h3>Watch it grow</h3>
            <p>
              Countries, miles and streaks add up into the living story of
              everywhere you've wandered.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ DISCOVER ============ -->
    <section id="discover" class="lp-sec lp-sec--tint">
      <div class="lp split">
        <div class="sec-head" style="max-width: none" data-reveal>
          <div class="label">// 04 — discover</div>
          <h2>Find the spots <b>locals actually love.</b></h2>
          <p>
            FarFlung surfaces hidden places near you — pulled from the journals
            of travelers who've been there, not from a sponsored list. The
            detour-worthy stuff.
          </p>
          <NuxtLink
            class="btn btn--outline btn--lg"
            to="/login"
            style="margin-top: 24px"
          >
            <AppIcon name="compass" :size="17" />
            explore nearby
          </NuxtLink>
        </div>
        <div class="place-list" data-reveal-stagger data-reveal-step="80">
          <NuxtLink class="place" to="/login">
            <div class="place__img ph">
              <div class="topo" style="opacity: 0.4" />
            </div>
            <div class="place__b">
              <div class="place__loc">Chiang Mai, TH</div>
              <div class="place__n">A coffee roaster down a side soi</div>
            </div>
            <div class="place__rate">
              <AppIcon name="star" :size="13" />
              4.9
            </div>
          </NuxtLink>
          <NuxtLink class="place" to="/login">
            <div class="place__img ph">
              <div class="topo" style="opacity: 0.4" />
            </div>
            <div class="place__b">
              <div class="place__loc">Lisbon, PT</div>
              <div class="place__n">Miradouro with no tour buses</div>
            </div>
            <div class="place__rate">
              <AppIcon name="star" :size="13" />
              4.8
            </div>
          </NuxtLink>
          <NuxtLink class="place" to="/login">
            <div class="place__img ph">
              <div class="topo" style="opacity: 0.4" />
            </div>
            <div class="place__b">
              <div class="place__loc">Mexico City, MX</div>
              <div class="place__n">Late-night taquería, locals only</div>
            </div>
            <div class="place__rate">
              <AppIcon name="star" :size="13" />
              5.0
            </div>
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- ============ JOURNAL SHOWCASE ============ -->
    <section id="journal" class="lp-sec">
      <div class="lp">
        <div class="sec-head" data-reveal>
          <div class="label">// 05 — the journal</div>
          <h2>Your travels, <b>beautifully kept.</b></h2>
          <p>
            Every entry is a small, lovely record — location, photos, the words
            you wrote that day. The opposite of a thousand un-labelled photos in
            a camera roll.
          </p>
        </div>
        <div class="entries3" data-reveal-stagger data-reveal-step="100">
          <article class="e3">
            <div class="e3__img ph">
              <div class="topo" style="opacity: 0.4" />
            </div>
            <div class="e3__b">
              <div class="e3__loc">
                <AppIcon name="pin" :size="11" /> Reykjavík, IS
              </div>
              <div class="e3__t">Harbor at 4am</div>
              <p class="e3__x">
                Cold morning, the whole harbor still asleep. Found coffee at a
                window and watched the boats.
              </p>
              <div class="e3__f">
                <span><AppIcon name="calendar" :size="13" /> Jun 12</span>
                <span><AppIcon name="image" :size="13" /> 6 photos</span>
                <span><AppIcon name="heart" :size="13" /> 24</span>
              </div>
            </div>
          </article>
          <article class="e3">
            <div class="e3__img ph">
              <div class="topo" style="opacity: 0.4" />
            </div>
            <div class="e3__b">
              <div class="e3__loc">
                <AppIcon name="pin" :size="11" /> Lisbon, PT
              </div>
              <div class="e3__t">Tram 28, again</div>
              <p class="e3__x">
                Took the long way through Alfama. Pastéis de nata, then a
                viewpoint I keep coming back to.
              </p>
              <div class="e3__f">
                <span><AppIcon name="calendar" :size="13" /> Jun 8</span>
                <span><AppIcon name="image" :size="13" /> 12 photos</span>
                <span><AppIcon name="heart" :size="13" /> 41</span>
              </div>
            </div>
          </article>
          <article class="e3">
            <div class="e3__img ph">
              <div class="topo" style="opacity: 0.4" />
            </div>
            <div class="e3__b">
              <div class="e3__loc">
                <AppIcon name="pin" :size="11" /> Tokyo, JP
              </div>
              <div class="e3__t">Last train from Shinjuku</div>
              <p class="e3__x">
                Neon and rain on the platform. Ramen at a counter that sat six.
                Wrote this on the ride home.
              </p>
              <div class="e3__f">
                <span><AppIcon name="calendar" :size="13" /> May 30</span>
                <span><AppIcon name="image" :size="13" /> 9 photos</span>
                <span><AppIcon name="heart" :size="13" /> 63</span>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- ============ TESTIMONIALS ============ -->
    <section id="loved" class="lp-sec lp-sec--tint">
      <div class="lp">
        <div class="sec-head center" data-reveal>
          <div class="label">// 06 — loved by travelers</div>
          <h2>The home base for <b>people without one.</b></h2>
        </div>
        <div class="quotes" data-reveal-stagger data-reveal-step="100">
          <figure class="quote">
            <div class="quote__stars">
              <AppIcon v-for="i in 5" :key="i" name="star" :size="15" />
            </div>
            <p>
              "I've lived out of a backpack for two years across eleven
              countries. FarFlung is the only record of it that I actually trust
              — and the only one I reread."
            </p>
            <figcaption class="quote__who">
              <span class="quote__av"><AppIcon name="user" :size="18" /></span>
              <span
                ><span class="quote__name">Maya R.</span><br /><span
                  class="quote__role"
                  >Product designer · remote</span
                ></span
              >
            </figcaption>
          </figure>
          <figure class="quote">
            <div class="quote__stars">
              <AppIcon v-for="i in 5" :key="i" name="star" :size="15" />
            </div>
            <p>
              "The photo import is magic. I land somewhere new and by the
              evening my whole day is already pinned and dated. No more mystery
              camera rolls."
            </p>
            <figcaption class="quote__who">
              <span class="quote__av"><AppIcon name="user" :size="18" /></span>
              <span
                ><span class="quote__name">Diego S.</span><br /><span
                  class="quote__role"
                  >Software engineer · digital nomad</span
                ></span
              >
            </figcaption>
          </figure>
          <figure class="quote">
            <div class="quote__stars">
              <AppIcon v-for="i in 5" :key="i" name="star" :size="15" />
            </div>
            <p>
              "Discover sends me to the places friends-of-friends loved, not the
              top ten lists. I've found my favorite cafés in three cities this
              way."
            </p>
            <figcaption class="quote__who">
              <span class="quote__av"><AppIcon name="user" :size="18" /></span>
              <span
                ><span class="quote__name">Priya K.</span><br /><span
                  class="quote__role"
                  >Writer · slow traveler</span
                ></span
              >
            </figcaption>
          </figure>
        </div>
      </div>
    </section>

    <!-- ============ PRICING TEASER ============ -->
    <section id="plans" class="lp-sec">
      <div class="lp">
        <div class="sec-head center" data-reveal>
          <div class="label">// 07 — plans</div>
          <h2>Start free. <b>Go further when you do.</b></h2>
          <p>
            Every plan keeps your map and journal forever. Upgrade only when
            you're traveling enough to need more.
          </p>
        </div>
        <div class="tiers" data-reveal-stagger data-reveal-step="100">
          <div class="tier">
            <div class="tier__name">Drifter</div>
            <div class="tier__price">$0<span>/forever</span></div>
            <p class="tier__desc">For the occasional trip.</p>
            <ul>
              <li>
                <AppIcon name="check" :size="15" /> Up to 50 pins &amp; entries
              </li>
              <li><AppIcon name="check" :size="15" /> Personal world map</li>
              <li><AppIcon name="check" :size="15" /> Manual photo upload</li>
            </ul>
            <NuxtLink
              class="btn btn--outline btn--block"
              :to="freeTierCtaTarget"
              >start free</NuxtLink
            >
          </div>
          <div class="tier tier--pop">
            <span class="tier__pop">most popular</span>
            <div class="tier__name accent-text">Wanderer</div>
            <div class="tier__price">$8<span>/mo</span></div>
            <p class="tier__desc">For the always-on the move.</p>
            <ul>
              <li>
                <AppIcon name="check" :size="15" /> Unlimited pins &amp; entries
              </li>
              <li>
                <AppIcon name="check" :size="15" /> Auto photo &amp; Instagram
                import
              </li>
              <li>
                <AppIcon name="check" :size="15" /> Multi-stop trip planning
              </li>
              <li><AppIcon name="check" :size="15" /> Discover hidden spots</li>
            </ul>
            <PlanCheckoutButton
              v-if="isSignedIn"
              tier="wanderer"
              cycle="monthly"
              class="btn btn--primary btn--block"
              >start free trial</PlanCheckoutButton
            >
            <NuxtLink v-else class="btn btn--primary btn--block" to="/login"
              >start free trial</NuxtLink
            >
          </div>
          <div class="tier">
            <div class="tier__name">Nomad</div>
            <div class="tier__price">$16<span>/mo</span></div>
            <p class="tier__desc">For the location-independent.</p>
            <ul>
              <li>
                <AppIcon name="check" :size="15" /> Everything in Wanderer
              </li>
              <li><AppIcon name="check" :size="15" /> Collaborative trips</li>
              <li>
                <AppIcon name="check" :size="15" /> Public traveler profile
              </li>
              <li><AppIcon name="check" :size="15" /> Priority support</li>
            </ul>
            <PlanCheckoutButton
              v-if="isSignedIn"
              tier="nomad"
              cycle="monthly"
              class="btn btn--outline btn--block"
              >start free trial</PlanCheckoutButton
            >
            <NuxtLink v-else class="btn btn--outline btn--block" to="/login"
              >start free trial</NuxtLink
            >
          </div>
        </div>
        <div class="tiers-foot" data-reveal>
          Need the full breakdown?
          <NuxtLink to="/pricing">Compare every feature →</NuxtLink>
        </div>
      </div>
    </section>

    <!-- ============ FINAL CTA ============ -->
    <section class="lp-sec">
      <div class="lp">
        <div class="cta" data-reveal>
          <div class="topo" />
          <div class="cta__in">
            <div class="label" style="justify-content: center">
              // the map is waiting
            </div>
            <h2>Start mapping <b>your story.</b></h2>
            <p>
              Join the travelers turning a moving life into something they can
              actually hold onto.
            </p>
            <form class="lp-capture" novalidate @submit.prevent="handleCapture">
              <span class="lp-capture__pill">
                <AppIcon name="mail" :size="16" />
                <input
                  v-model="email"
                  type="email"
                  placeholder="you@domain.com"
                  aria-label="Email address"
                  autocomplete="email"
                />
              </span>
              <button class="btn btn--primary btn--lg" type="submit">
                start free
                <AppIcon name="arrow-right" :size="15" />
              </button>
            </form>
            <p class="lp-capture__note">
              <AppIcon name="check" :size="13" />
              Free forever plan · no card needed · 2-minute setup
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ FOOTER ============ -->
    <footer class="ftr">
      <div class="lp">
        <div class="ftr__grid">
          <div class="ftr__brand">
            <NuxtLink class="brand" to="/">
              <AppIcon name="compass" :size="26" class="brand__mark" />
              <span class="brand__name">wander<b>ist</b></span>
            </NuxtLink>
            <p>
              The travel journal &amp; map for people who never quite stop
              moving. Pin it, write it, remember it.
            </p>
          </div>
          <div class="ftr__col">
            <h4>Product</h4>
            <a href="#features">Features</a>
            <a href="#map">The map</a>
            <a href="#journal">Journal</a>
            <NuxtLink to="/pricing">Plans</NuxtLink>
          </div>
          <div class="ftr__col">
            <h4>Explore</h4>
            <a href="#how">How it works</a>
            <a href="#discover">Discover</a>
            <NuxtLink to="/home">Product tour</NuxtLink>
            <NuxtLink to="/login">Sign in</NuxtLink>
          </div>
          <div class="ftr__col">
            <h4>Company</h4>
            <a href="#">About</a>
            <a href="#">Journal blog</a>
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
          </div>
        </div>
        <div class="ftr__base">
          <span>© 2026 FarFlung · made for the perpetually elsewhere</span>
          <span class="hstack gap-12">
            <span>Space Grotesk · JetBrains Mono</span>
            <AppThemeToggle />
          </span>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
useHead({ title: "FarFlung — Track every place you wander" });
useScrollReveal();

const { isSignedIn } = useClerkAuth();

// Signed-in visitors already have an account — "start free" on the Drifter
// tier sends them straight into the app rather than back to login.
const freeTierCtaTarget = computed(() =>
  isSignedIn.value ? "/home" : "/login",
);

const email = ref("");
const navStuck = ref(false);

function handleCapture() {
  if (!email.value) {
    return;
  }
  navigateTo(`/login?email=${encodeURIComponent(email.value)}`);
}

if (import.meta.client) {
  onMounted(() => {
    const onScroll = () => {
      navStuck.value = window.scrollY > 8;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onUnmounted(() => window.removeEventListener("scroll", onScroll));
  });
}
</script>

<style scoped>
html {
  scroll-behavior: smooth;
}

.lp {
  max-width: var(--maxw);
  margin: 0 auto;
  padding: 0 clamp(20px, 5vw, 56px);
}
section[id] {
  scroll-margin-top: 84px;
}

/* nav */
.mk-nav {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 14px clamp(20px, 5vw, 56px);
  border-bottom: 1px solid transparent;
  transition:
    border-color 0.2s,
    background 0.2s;
}
.mk-nav.is-stuck {
  border-color: var(--line);
  background: color-mix(in srgb, var(--bg) 84%, transparent);
  backdrop-filter: blur(12px);
}
.mk-nav__links {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 26px;
  font-size: 12.5px;
  color: var(--ink-2);
}
.mk-nav__links .nl {
  transition: color 0.14s;
}
.mk-nav__links .nl:hover {
  color: var(--accent-ink);
}
@media (max-width: 760px) {
  .mk-nav__links .nl {
    display: none;
  }
}

/* hero shared */
.lp-hero {
  padding: clamp(40px, 7vw, 86px) 0 clamp(48px, 7vw, 78px);
  overflow: hidden;
  position: relative;
}
.lp-hero h1 {
  font-size: clamp(40px, 6.4vw, 78px);
  line-height: 0.96;
  font-weight: 700;
  letter-spacing: -0.035em;
  margin: 18px 0 0;
}
.lp-hero h1 b {
  color: var(--accent-ink);
}
.lp-hero__sub {
  max-width: 500px;
  margin: 22px 0 0;
  color: var(--ink-2);
  font-size: 15px;
  line-height: 1.65;
}

/* hero A */
.lp-hero--a .in {
  display: grid;
  grid-template-columns: 1.02fr 0.98fr;
  gap: clamp(28px, 5vw, 64px);
  align-items: center;
}
.hero-map {
  position: relative;
  height: 440px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--line);
  box-shadow: var(--shadow-lg);
  background:
    repeating-linear-gradient(
      0deg,
      transparent 0 47px,
      color-mix(in srgb, var(--line) 55%, transparent) 47px 48px
    ),
    repeating-linear-gradient(
      90deg,
      transparent 0 47px,
      color-mix(in srgb, var(--line) 55%, transparent) 47px 48px
    ),
    var(--bg-tint);
}
.hero-map .topo {
  opacity: calc(var(--topo-opacity) * 2.1);
}
.pin-abs {
  position: absolute;
  transform: translate(-50%, -100%);
}
.pin-abs.sm :deep(svg) {
  width: 18px;
  height: 18px;
}
.pin-tip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 5px;
  white-space: nowrap;
  background: var(--ink);
  color: var(--bg);
  font-size: 10.5px;
  letter-spacing: 0.02em;
  padding: 4px 8px;
  border-radius: 6px;
  box-shadow: var(--shadow);
}
.hero-chip {
  position: absolute;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 99px;
  padding: 7px 13px 7px 9px;
  box-shadow: var(--shadow);
  font-size: 11.5px;
}
.hero-chip .dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--accent-weak);
  color: var(--accent-ink);
  display: grid;
  place-items: center;
}
.hero-chip b {
  font-family: var(--font-display);
  font-weight: 700;
}

/* email capture */
.lp-capture {
  display: flex;
  gap: 8px;
  max-width: 452px;
  margin-top: 30px;
  flex-wrap: wrap;
}
.lp-capture__pill {
  flex: 1 1 240px;
  display: flex;
  align-items: center;
  gap: 9px;
  background: var(--surface-2);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
  padding: 0 13px;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}
.lp-capture__pill:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-weak);
}
.lp-capture__pill :deep(svg) {
  color: var(--muted);
  flex: none;
}
.lp-capture input {
  flex: 1;
  min-width: 0;
  border: none;
  background: none;
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 13.5px;
  padding: 12px 0;
  outline: none;
}
.lp-capture input::placeholder {
  color: var(--faint);
}
.lp-capture .btn {
  flex: none;
}
.lp-capture__note {
  margin: 12px 0 0;
  font-size: 11.5px;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 7px;
}

/* sections */
.lp-sec {
  padding: clamp(56px, 8vw, 92px) 0;
}
.lp-sec--tint {
  background: var(--bg-tint);
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
.sec-head {
  max-width: 620px;
}
.sec-head.center {
  margin: 0 auto;
  text-align: center;
}
.sec-head.center .label {
  justify-content: center;
}
.sec-head h2 {
  font-size: clamp(28px, 4vw, 44px);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.02;
  margin: 14px 0 0;
}
.sec-head h2 b {
  color: var(--accent-ink);
}
.sec-head p {
  margin: 16px 0 0;
  color: var(--ink-2);
  font-size: 15px;
  line-height: 1.6;
}

/* features */
.feat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-top: 44px;
}
.feat {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 24px 22px;
  transition:
    transform 0.16s,
    box-shadow 0.16s,
    border-color 0.16s;
}
.feat:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
  border-color: var(--accent-line);
}
.feat__ico {
  width: 42px;
  height: 42px;
  border-radius: 11px;
  background: var(--accent-weak);
  color: var(--accent-ink);
  display: grid;
  place-items: center;
}
.feat h3 {
  font-size: 17px;
  margin: 18px 0 8px;
}
.feat p {
  font-size: 12.5px;
  color: var(--muted);
  line-height: 1.6;
  margin: 0;
}

/* map showcase */
.show-map {
  position: relative;
  height: clamp(360px, 46vw, 520px);
  border-radius: var(--radius-lg);
  overflow: hidden;
  margin-top: 46px;
  border: 1px solid var(--line);
  box-shadow: var(--shadow-lg);
  background:
    repeating-linear-gradient(
      0deg,
      transparent 0 55px,
      color-mix(in srgb, var(--line) 50%, transparent) 55px 56px
    ),
    repeating-linear-gradient(
      90deg,
      transparent 0 55px,
      color-mix(in srgb, var(--line) 50%, transparent) 55px 56px
    ),
    var(--bg-tint);
}
.show-map .topo {
  opacity: calc(var(--topo-opacity) * 2);
}
.show-map__legend {
  position: absolute;
  left: 20px;
  bottom: 20px;
  z-index: 4;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* steps */
.steps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
  margin-top: 46px;
}
.step {
  position: relative;
  padding-top: 26px;
}
.step::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 30px;
  height: 2px;
  background: var(--accent);
}
.step__n {
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 700;
  color: var(--accent-ink);
  letter-spacing: 0.1em;
}
.step__ico {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--accent);
  display: grid;
  place-items: center;
  margin: 16px 0;
}
.step h3 {
  font-size: 18px;
  margin: 0 0 8px;
}
.step p {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.6;
  margin: 0;
}

/* discover */
.split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: clamp(28px, 5vw, 64px);
  align-items: center;
}
.place-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.place {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 13px 15px;
  transition:
    border-color 0.14s,
    transform 0.14s;
}
.place:hover {
  border-color: var(--accent-line);
  transform: translateX(4px);
}
.place__img {
  width: 56px;
  height: 56px;
  flex: none;
  border-radius: var(--radius-sm);
}
.place__b {
  min-width: 0;
  flex: 1;
}
.place__loc {
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}
.place__n {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 15px;
  margin: 3px 0 0;
}
.place__rate {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--ink-2);
}
.place__rate :deep(svg) {
  color: var(--warning);
}

/* journal showcase */
.entries3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 44px;
}
.e3 {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
  transition:
    transform 0.16s,
    box-shadow 0.16s,
    border-color 0.16s;
}
.e3:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
  border-color: var(--accent-line);
}
.e3__img {
  height: 152px;
  position: relative;
}
.e3__b {
  padding: 16px 17px 18px;
}
.e3__loc {
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent-ink);
  display: flex;
  align-items: center;
  gap: 5px;
}
.e3__t {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 17px;
  margin: 8px 0 6px;
}
.e3__x {
  font-size: 12.5px;
  color: var(--muted);
  line-height: 1.55;
  margin: 0;
}
.e3__f {
  margin-top: 14px;
  padding-top: 13px;
  border-top: 1px solid var(--line);
  display: flex;
  gap: 15px;
  font-size: 11px;
  color: var(--faint);
  align-items: center;
}
.e3__f span {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* testimonials */
.quotes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 44px;
}
.quote {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 24px 22px;
  display: flex;
  flex-direction: column;
}
.quote__stars {
  display: flex;
  gap: 2px;
  color: var(--warning);
  margin-bottom: 14px;
}
.quote p {
  font-size: 14px;
  line-height: 1.65;
  color: var(--ink);
  margin: 0 0 20px;
}
.quote__who {
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: 11px;
}
.quote__av {
  width: 38px;
  height: 38px;
  border-radius: 9px;
  background: var(--accent-weak);
  color: var(--accent-ink);
  display: grid;
  place-items: center;
  flex: none;
}
.quote__name {
  font-size: 13px;
  font-weight: 600;
}
.quote__role {
  font-size: 11px;
  color: var(--muted);
}

/* pricing teaser */
.tiers {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 44px;
}
.tier {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 26px 24px;
  display: flex;
  flex-direction: column;
  position: relative;
}
.tier--pop {
  border-color: var(--accent-line);
  box-shadow: var(--shadow-lg);
}
.tier__pop {
  position: absolute;
  top: -11px;
  left: 24px;
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  background: var(--accent);
  color: #fff;
  padding: 4px 10px;
  border-radius: 99px;
}
:global(html[data-theme="dark"]) .tier__pop {
  color: #15101e;
}
.tier__name {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 600;
}
.tier__price {
  font-family: var(--font-display);
  font-size: 38px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 10px 0 2px;
}
.tier__price span {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 400;
  color: var(--muted);
}
.tier__desc {
  font-size: 12px;
  color: var(--muted);
  margin: 0 0 18px;
}
.tier ul {
  list-style: none;
  padding: 0;
  margin: 0 0 22px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.tier li {
  display: flex;
  gap: 9px;
  font-size: 12.5px;
  color: var(--ink-2);
  align-items: flex-start;
}
.tier li :deep(svg) {
  color: var(--accent);
  flex: none;
  margin-top: 1px;
}
.tier .btn {
  margin-top: auto;
}
.tiers-foot {
  text-align: center;
  margin-top: 26px;
  font-size: 12.5px;
}
.tiers-foot a {
  color: var(--accent-ink);
}

/* final CTA */
.cta {
  position: relative;
  overflow: hidden;
  text-align: center;
  border-radius: var(--radius-lg);
  border: 1px solid var(--line);
  background: var(--surface);
  padding: clamp(48px, 7vw, 84px) clamp(24px, 5vw, 40px);
  box-shadow: var(--shadow-lg);
}
.cta .topo {
  opacity: calc(var(--topo-opacity) * 1.8);
}
.cta__in {
  position: relative;
  z-index: 2;
  max-width: 640px;
  margin: 0 auto;
}
.cta h2 {
  font-size: clamp(32px, 5vw, 56px);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1;
  margin: 14px 0 0;
}
.cta h2 b {
  color: var(--accent-ink);
}
.cta p {
  margin: 18px 0 0;
  color: var(--ink-2);
  font-size: 15px;
}
.cta .lp-capture {
  justify-content: center;
  margin-left: auto;
  margin-right: auto;
}
.cta .lp-capture__note {
  justify-content: center;
}

/* footer */
.ftr {
  padding: 56px 0 40px;
  border-top: 1px solid var(--line);
}
.ftr__grid {
  display: grid;
  grid-template-columns: 1.6fr 1fr 1fr 1fr;
  gap: 32px;
}
.ftr__brand p {
  max-width: 280px;
  color: var(--muted);
  font-size: 12.5px;
  line-height: 1.6;
  margin: 14px 0 0;
}
.ftr__col h4 {
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--faint);
  margin: 0 0 14px;
  font-family: var(--font-mono);
  font-weight: 500;
}
.ftr__col a {
  display: block;
  font-size: 13px;
  color: var(--ink-2);
  padding: 5px 0;
  transition: color 0.14s;
}
.ftr__col a:hover {
  color: var(--accent-ink);
}
.ftr__base {
  margin-top: 44px;
  padding-top: 22px;
  border-top: 1px solid var(--line);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  font-size: 11.5px;
  color: var(--muted);
}

@media (max-width: 980px) {
  .feat-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .steps,
  .entries3,
  .quotes,
  .tiers {
    grid-template-columns: 1fr;
  }
  .lp-hero--a .in,
  .split {
    grid-template-columns: 1fr;
  }
  .hero-map {
    display: none;
  }
  .ftr__grid {
    grid-template-columns: 1fr 1fr;
  }
  .ftr__brand {
    grid-column: 1 / -1;
  }
}
@media (max-width: 560px) {
  .feat-grid {
    grid-template-columns: 1fr;
  }
  .ftr__grid {
    grid-template-columns: 1fr;
  }
}
</style>
