<template>
  <footer class="ftr">
    <div class="lp">
      <div class="ftr__grid">
        <div class="ftr__brand">
          <NuxtLink class="brand" to="/">
            <AppIcon name="compass" :size="26" class="brand__mark" />
            <span class="brand__name">far<b>flung</b></span>
          </NuxtLink>
          <p>
            The travel journal &amp; map for people who never quite stop moving.
            Pin it, write it, remember it.
          </p>
        </div>
        <div class="ftr__col">
          <h4>Product</h4>
          <NuxtLink to="/#features">Features</NuxtLink>
          <NuxtLink to="/#map">The map</NuxtLink>
          <NuxtLink to="/#journal">Journal</NuxtLink>
          <NuxtLink to="/pricing">Plans</NuxtLink>
        </div>
        <div class="ftr__col">
          <h4>Explore</h4>
          <NuxtLink to="/#how">How it works</NuxtLink>
          <NuxtLink to="/#discover">Discover</NuxtLink>
          <NuxtLink to="/login">Sign in</NuxtLink>
        </div>
        <div class="ftr__col">
          <h4>Company</h4>
          <a href="#">About</a>
          <NuxtLink to="/contact">Contact</NuxtLink>
          <NuxtLink to="/privacy">Privacy</NuxtLink>
          <NuxtLink to="/terms">Terms</NuxtLink>
        </div>
      </div>
      <div class="ftr__base">
        <span>© 2026 FarFlung · made for the perpetually elsewhere</span>
        <AppThemeToggle />
      </div>
    </div>
  </footer>
</template>

<style scoped>
.lp {
  max-width: var(--maxw);
  margin: 0 auto;
  padding: 0 clamp(20px, 5vw, 56px);
}
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
  .ftr__grid {
    grid-template-columns: 1fr 1fr;
  }
  .ftr__brand {
    grid-column: 1 / -1;
  }
}
@media (max-width: 560px) {
  .ftr__grid {
    grid-template-columns: 1fr;
  }
}
</style>
