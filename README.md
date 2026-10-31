# FarFlung

A travel planning and exploration app.

## Requirements

- Node.js >= 24 (see [.nvmrc](.nvmrc))
- npm

## Setup

Install dependencies:

```bash
npm install
```

## Environment variables

Secrets are managed with [dotenvx](https://dotenvx.com): the `.env*` files are
committed **encrypted**, and one private key per environment (held off-repo in
`.env.keys`) decrypts them. `.env.example` documents every variable and where to
obtain it.

| File              | Environment                    | Decrypted by                    |
| ----------------- | ------------------------------ | ------------------------------- |
| `.env`            | local dev                      | `DOTENV_PRIVATE_KEY`            |
| `.env.dev`        | Netlify branch/preview deploys | `DOTENV_PRIVATE_KEY_DEV`        |
| `.env.e2e`        | e2e tests (local + CI)         | `DOTENV_PRIVATE_KEY_E2E`        |
| `.env.production` | Netlify production             | `DOTENV_PRIVATE_KEY_PRODUCTION` |

`.env.keys` holds all the private keys and is gitignored — **back it up to your
password manager**; losing it makes the encrypted files unrecoverable. To run a
command with a file's secrets injected, the npm scripts wrap it in
`dotenvx run -f <file> --` (e.g. `npm run dev` uses `.env`, `npm run e2e` uses
`.env.e2e`). Change a value with `npx dotenvx set KEY value -f <file>`.

Server-side secrets are read as `process.env.X || useRuntimeConfig().x`: at
build time dotenvx injects them into `process.env`, Nuxt bakes them into the
server bundle via `runtimeConfig`, and the deployed function reads them from
there — so they do **not** need to be set in Netlify's runtime env. Public
client values (`NUXT_PUBLIC_*`) are captured the same way, by
`public-runtime-config.ts` and the `clerk` block in `nuxt.config.ts`. A new
public value must be added there, or it reaches production blank.

The only variables Netlify needs are the `DOTENV_PRIVATE_KEY_*` keys, in Builds
scope. Scheduled functions are bundled outside Nuxt, so `scheduled-function-env.ts`
writes the values they need to a gitignored module at build, and
`TRUST_NETLIFY_CLIENT_IP` is inlined by `nitro.replace`.

`NUXT_PUBLIC_SENTRY_DSN` is a special case: `sentry.server.config.ts` runs
before `useRuntimeConfig()` exists, so per Sentry's docs it can only read the
DSN from `process.env` — which dotenvx does not populate in a deployed function.
Because the DSN is public (non-secret), `nuxt.config.ts` inlines it as a build-
time literal via `nitro.replace`, so each environment's build bakes its own DSN
and no Netlify runtime variable is needed. The client reads the baked
`runtimeConfig.public.sentryDsn` and needs no replacement.

## Database

The app uses [Drizzle ORM](https://orm.drizzle.team) with a [Neon](https://neon.tech) serverless Postgres database.

Push the schema to Neon (useful for initial setup):

```bash
npm run db:push
```

Generate a migration from schema changes:

```bash
npm run db:generate
```

Apply pending migrations:

```bash
npm run db:migrate
```

Open Drizzle Studio (visual database browser):

```bash
npm run db:studio
```

### Migrations in CI

Migrations are generated and committed locally, then applied automatically by CI — never generated at deploy time.

- **Deploy previews / e2e:** each spec run creates an ephemeral Neon branch (copy-on-write from production, so it starts with production's schema), then applies any pending committed migrations to it before the tests run. The migrate step uses the branch's **direct** (non-pooler) connection; the app under test uses the pooled one.
- **Production:** the weekly deploy workflow (`.github/workflows/weekly-production-deploy.yml`) runs `npm run db:migrate:production` (`dotenvx run -f .env.production -- drizzle-kit migrate`) right before it calls the Netlify build hook, decrypting `.env.production` with the `DOTENV_PRIVATE_KEY_PRODUCTION` repository secret. A push to `main` never touches the production database, so schema and code ship together. Running it as its own step — rather than inside the Netlify build — makes a failed migration fail loudly instead of half-deploying, and a failed migration means no hook call.

Migrations must use a **direct** Neon connection, not the pooled one the running app uses. `.env.production` holds `DATABASE_URL_UNPOOLED` (the production Neon host without `-pooler`), and `drizzle.config.ts` prefers it over the pooled `DATABASE_URL`. Add a new migration to production by committing the generated SQL and merging to `main`; it is applied at the next weekly (or manual) production deploy.

## Map (Mapbox GL)

The `/map` page uses [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/guides/) to render a real interactive map with place markers, zoom controls, a base-style switcher, and a drop-a-pin flow for creating new places.

To enable the map, set a Mapbox public access token. Without it the page degrades gracefully to a CSS placeholder.

1. Create a public token at [https://account.mapbox.com/access-tokens/](https://account.mapbox.com/access-tokens/).
2. Set `NUXT_PUBLIC_MAPBOX_TOKEN=<your-token>` in your `.env`.

Available base styles: Outdoors, Streets, Satellite, Light, Dark, and FarFlung violet (custom). All of them use Mapbox's stock styles, so nothing beyond the public token is needed. FarFlung violet is the stock Light style recoloured at runtime (water, land and roads) each time a style loads; see `app/composables/mapboxBrandStyle.ts`. The default style chosen in Settings is applied when `/map` opens (falling back to Outdoors if the plan doesn't allow it); picking a style in the map's own picker lasts for the session only.

## Media storage

File uploads (photos, cover images) are stored in [Netlify Blobs](https://docs.netlify.com/blobs/overview/) under the `media` store. Blobs are keyed as `<userId>/<mediaId>` and served back through the proxy route `GET /api/media/[id]`, which sets long-lived `Cache-Control` headers.

### Local development

The recommended approach is to run the app via the [Netlify CLI](https://docs.netlify.com/cli/overview/):

```bash
netlify dev
```

`netlify dev` injects `NETLIFY_SITE_ID` and an auth token automatically, so Blobs works with no extra configuration. The local store is sandboxed and does not read from production.

If you run `npm run dev` directly (without `netlify dev`), set the following variables in your `.env`:

```
NETLIFY_SITE_ID=<your-project-id>   # Project settings → General
NETLIFY_AUTH_TOKEN=<token>          # User settings → OAuth → Personal access tokens
```

### Production

On Netlify, no extra configuration is needed. The runtime injects credentials automatically.

---

## Authentication

Authentication is handled by [Clerk](https://clerk.com) via the `@clerk/nuxt` module. Server middleware at `server/middleware/auth.ts` verifies the session on every request and makes the user available at `event.context.userId` in API route handlers.

### Clerk webhook setup

Clerk webhooks keep the `users` table in sync with Clerk's user directory. The webhook handler lives at `server/api/webhooks/clerk.post.ts` and listens for `user.created`, `user.updated`, and `user.deleted` events.

To configure the webhook in the Clerk Dashboard:

1. Go to **Clerk Dashboard → Webhooks → Add Endpoint**.
2. Set the endpoint URL to `https://<your-domain>/api/webhooks/clerk`.
3. Subscribe to the `user.created`, `user.updated`, and `user.deleted` events.
4. Copy the **Signing Secret** (starts with `whsec_`) and set it as `NUXT_CLERK_WEBHOOK_SECRET` in your environment.

## Billing

FarFlung uses **[Stripe](https://stripe.com)** directly (Checkout + the Billing Portal) to sell the Wanderer and Nomad plans advertised on `/pricing` and the `/` pricing teaser, kept consistent with how billing is already set up on other projects in this account rather than going through Clerk Billing.

### Dashboard setup (required before checkout works)

1. Go to **Stripe Dashboard → Product catalog** and create two products, each with a monthly and a yearly recurring Price matching `/pricing`:
   - **Wanderer** — $8/mo, $6/mo billed yearly.
   - **Nomad** — $16/mo, $12/mo billed yearly.
2. Copy each Price's ID (`price_...`) into `STRIPE_PRICE_WANDERER_MONTHLY`, `STRIPE_PRICE_WANDERER_YEARLY`, `STRIPE_PRICE_NOMAD_MONTHLY`, `STRIPE_PRICE_NOMAD_YEARLY`. These are dashboard-generated and cannot be guessed or hardcoded — until they're set, the matching checkout button on `/pricing` and `/` renders disabled instead of opening a broken checkout.
3. Copy your **Secret key** (Developers → API keys) into `STRIPE_SECRET_KEY`. Use a test-mode key for local/staging.
4. Go to **Developers → Webhooks → Add endpoint**, set the URL to `https://<your-domain>/api/webhooks/stripe`, and subscribe to: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `checkout.session.completed`. Copy the endpoint's **Signing secret** into `STRIPE_WEBHOOK_SECRET`.
5. Go to **Settings → Billing → Customer portal** and enable it (the default configuration works — customers need to be able to cancel and update their payment method).

### How it works

- The `subscriptions` table (`server/db/schema.ts`) holds the current plan, status, billing cycle, trial/renewal dates, and Stripe customer/subscription IDs for each user. A user with no row is on the free Drifter plan by definition — Stripe never sends a subscription webhook for the implicit free tier.
- `<PlanCheckoutButton>` (`app/components/PlanCheckoutButton.vue`) and `<PlanManageButton>` (`app/components/PlanManageButton.vue`) are plain buttons that navigate the browser to `GET /api/billing/checkout` / `GET /api/billing/portal`, which create a Stripe Checkout Session / Billing Portal session server-side and redirect there — the same "redirect to a hosted third-party flow" pattern already used for Instagram OAuth (`server/api/connections/instagram/start.get.ts`). Signed-out visitors on `/pricing` and `/` still see a plain `/login` link instead of the checkout button. `checkout.get.ts` also rejects (`409`) a request from a user who already holds a live paid subscription, so a repeat click can't start a second Stripe subscription on the same customer.
- `<PlanCheckoutButton>` renders disabled until `GET /api/billing/config` (via `app/composables/useBillingConfig.ts`) confirms a Price ID is configured for that tier/cycle. This is a real per-request server call, not a build-time Nuxt public runtimeConfig value — `STRIPE_PRICE_*` are deliberately server-only env vars, so there's no `NUXT_PUBLIC_*`-named counterpart Nitro could use to refresh a baked-in config value at runtime.
- `server/api/webhooks/stripe.post.ts` verifies the `Stripe-Signature` header and syncs the `subscriptions` row from `customer.subscription.created` / `.updated` (upsert) and `customer.subscription.deleted` (mark canceled). `checkout.session.completed` is acknowledged but not separately handled — Stripe recommends syncing subscription state from `customer.subscription.*` events, which carry the full Subscription object and fire around the same time.
- `server/utils/stripe.ts` isolates every Stripe SDK call (client construction, Checkout/Portal session creation, webhook verification, Price ID ↔ plan/cycle mapping) behind one boundary so it's mockable in tests. `server/utils/subscriptions.ts` isolates the DB read/write side (mapping a Stripe Subscription onto the `subscriptions` row, plan-limit lookups) — the same split Clerk's own SDK access uses (`server/utils/clerk.ts`).
- `server/utils/planLimits.ts` centralizes the advertised `/pricing` limits (places, active trips, photo storage, map styles, Instagram sync, public traveler profile) and is wired into the relevant API routes (`POST /api/places`, `POST /api/trips`, `POST /api/media`, the Instagram connection routes, and `PATCH /api/preferences`). A request that would exceed the current plan's limit gets a `402 Payment Required` with a message naming the limit and plan. This layer is provider-agnostic and was unaffected by the Clerk Billing → Stripe switch.
- `GET /api/billing/subscription` (used by `app/composables/useBilling.ts`) returns the current user's plan/status/trial/renewal info for the Settings page.

### Product decisions

- **Cancellation timing**: canceling via the Billing Portal defaults to Stripe's own "cancel at period end" behavior — the subscription stays `active` (with `cancelAtPeriodEnd` set) for the rest of the paid period, and `customer.subscription.deleted` only fires once it actually ends, at which point access is revoked. This is a safer, more accurate default than the previous Clerk Billing integration could offer (Clerk's webhook payloads couldn't distinguish "scheduled to cancel" from "revoked now").
- **Trial detection**: Stripe's Subscription object exposes `trial_end` directly on every `customer.subscription.*` event for the life of the trial, so `trialEndsAt` is populated from day one of a trial — an improvement over the Clerk Billing integration, which could only detect a trial 3 days before it ended.
- **Plan-limit enforcement**: unchanged — `getEffectivePlan()` still collapses any non-`active` status to the free Drifter plan (no grace period for `past_due`), the same conservative default as before.

## Connected accounts

### Instagram (photo import)

FarFlung connects to Instagram with **Instagram API with Instagram Login** (the `api.instagram.com` / `graph.instagram.com` hosts; the Basic Display API was retired in December 2024). It works with Business or Creator Instagram accounts and needs no Facebook Page. The only scope requested is `instagram_business_basic`.

**Setup:**

1. Go to [Meta for Developers](https://developers.facebook.com) and create an app (use case: Other, type: Business).
2. Add the **Instagram** product, then open **API setup with Instagram login**.
3. Under **Business login settings**, add `https://<your-domain>/api/connections/instagram/callback` as an OAuth redirect URI. Meta may add a trailing slash to what you enter; use exactly what the list shows.
4. Copy the **Instagram app ID** and **Instagram app secret** shown in that same section (these are not the main Meta app ID and secret) and set them as `INSTAGRAM_CLIENT_ID` and `INSTAGRAM_CLIENT_SECRET`.
5. While the app is in development mode, only Instagram accounts added under App roles > Instagram Testers (and accepted in Instagram) can connect.

`NUXT_PUBLIC_SITE_ORIGIN` must be set too: the redirect URI is built from it.

**How it works:**

- `GET /api/connections/instagram/start` returns `{ url }`, the Instagram authorization URL. The settings page fetches it with the Clerk Bearer token and then navigates, because a full-page navigation can't send that header. The URL carries an HMAC-signed `state` (user id, random nonce, 10 minute expiry) and the nonce is also set as an httpOnly cookie.
- `GET /api/connections/instagram/callback` arrives as a plain browser redirect from Instagram with no Authorization header, so `server/middleware/auth.ts` lets that one path through and the handler authenticates from the signed `state`, which must also match the nonce cookie in the same browser (see `server/utils/oauthState.ts`). It then exchanges the code for a long-lived token (60-day expiry), stores the encrypted token in `connected_accounts`, and redirects to `/settings#connections`.
- `DELETE /api/connections/instagram` removes the row from `connected_accounts`, revoking access.
- `POST /api/connections/instagram/import` pulls image media, stores images in Netlify Blobs, and creates journal entries with no place (Instagram's media API exposes no location, so users place them themselves). Refreshes the stored token first when it is near expiry so imports self-heal. The client follows Instagram's `paging.next` up to a fixed page bound (the `INSTAGRAM_MAX_MEDIA_PAGES` constant in `server/utils/instagramClient.ts`, not an env var) so photos older than the most recent batch are still ingested; re-imports are idempotent via `media.source_id`.

Instagram sync is a Wanderer and Nomad feature; a Drifter sees an upgrade prompt instead of a connect button.

Access tokens are encrypted at rest using AES-256-GCM. Generate a key with `openssl rand -hex 32` and set it as `TOKEN_ENCRYPTION_KEY`. The same key, domain-separated, signs the OAuth `state`.

**Token refresh.** Instagram long-lived tokens expire after 60 days. The stored expiry (`connected_accounts.expires_at`) drives two refresh paths so a connection never lapses silently:

- **On use** — `import.post` refreshes and re-persists the token whenever it is within `INSTAGRAM_REFRESH_THRESHOLD_DAYS` of expiry (`server/utils/instagramToken.ts`).
- **Scheduled** — `netlify/functions/refresh-instagram-tokens.mts` (daily via `netlify.toml`) renews tokens for accounts that go quiet, so an inactive user's connection stays alive (`server/utils/refreshInstagramTokens.ts`).

Because the scheduled function runs in the Netlify Functions runtime (not the Nitro bundle), it gets `DATABASE_URL` and `TOKEN_ENCRYPTION_KEY` from the build-time module written by `scheduled-function-env.ts`, the same as the `purge-deleted-accounts` scheduled function, so neither is set in Netlify.

### Google (via Clerk)

Google is linked through Clerk's external accounts. The Settings > Connections **connect** button calls `user.createExternalAccount({ strategy: "oauth_google", redirectUrl })` in the browser and navigates to the Google URL Clerk returns; Clerk completes the OAuth round trip and sends the user back to `/settings?connection=google_success#connections`. There is no database row: the section reads the real connection state from Clerk's API.

- `GET /api/connections/google` returns `{ connected, emailAddress, identificationId }` from Clerk.
- `DELETE /api/connections/google` removes the Google external account from the user's Clerk record via the Clerk Backend API.

Google has to be enabled in the [Clerk Dashboard](https://dashboard.clerk.com) under Configure > SSO connections > Google (add a connection for all users). In production Clerk requires your own Google OAuth client ID and secret; the development instance uses shared credentials.

## Public profile URLs

A traveler's public profile lives at `/@<handle>` once they choose a handle in Settings, and at `/u/<clerk id>` always. A `/u/<id>` visit redirects (client-side, replace) to `/@<handle>` when the owner has a well-formed handle.

- Handles are 3 to 30 characters of letters, digits, hyphen and underscore (starting and ending with a letter or digit), not case sensitive, and a list of reserved words is refused (`server/utils/handle.ts`). The casing the user typed is kept for display.
- Uniqueness is enforced by a unique index on `lower(handle)` (migration `0013_add_handle_lower_unique`).
- `GET /api/handles/<handle>` resolves a handle to a profile. It is in the optional-auth allowlist but runs the same `requireViewableProfile` gate as `/api/users/<id>`, so an unknown handle and a private profile are the same 404.
- `GET /api/handles/<handle>/availability` (session required) feeds the live check in Settings.
- The route itself is registered in `nuxt.config.ts` through `handle-route.config.ts`, as a second route for `app/pages/u/[id].vue`.

---

## Development

Start the dev server at `http://localhost:3000`:

```bash
npm run dev
```

## Testing

Run unit tests in watch mode:

```bash
npm test
```

Run once (CI mode):

```bash
npm run test:ci
```

Run end-to-end tests (requires `.env.e2e`):

```bash
npm run e2e
```

## Linting

Check for issues:

```bash
npm run lint
```

Auto-fix:

```bash
npm run lint:fix
```

## Security scanning

A deterministic scanner layer runs both locally and in CI.

### Secret detection (gitleaks)

[gitleaks](https://github.com/gitleaks/gitleaks) scans for committed secrets. The
rules live in [.gitleaks.toml](.gitleaks.toml): the built-in default ruleset plus
custom rules for Clerk secret keys (`sk_live_` / `sk_test_`) and Postgres
connection strings with embedded credentials. Example env files and test fixtures
are allowlisted.

A husky `pre-commit` hook scans staged changes and blocks the commit on any
finding. Install it (and all other hooks) with:

```bash
npm install
```

To run the same staged scan manually:

```bash
gitleaks git --staged --redact --no-banner --config .gitleaks.toml
```

Install the gitleaks binary locally with `brew install gitleaks` (macOS) or from the
[releases page](https://github.com/gitleaks/gitleaks/releases). In CI the pinned
binary is downloaded (and checksum-verified) before it runs — pull requests scan
the PR commit range, pushes scan full history, and any finding fails the build.

### Dependency vulnerabilities

CI runs `npm audit` and fails the build only on **high** or **critical**
advisories; moderate and low are printed as a summary but do not fail.
[Dependabot](.github/dependabot.yml) opens grouped minor/patch update PRs weekly.

## Build & Preview

```bash
npm run build
npm run preview
```

## Deployment

### Deploys

Production deploys once a week, on Mondays at 14:00 UTC, via a Netlify build hook called by `.github/workflows/weekly-production-deploy.yml`. Merging to `main` does not start a production build or touch the production database: the `[context.production]` `ignore` command in `netlify.toml` cancels any production build that was not triggered by a hook. Pull requests still get Deploy Previews, and branch deploys still build on push.

The weekly run first requires CI on the `main` HEAD commit to have concluded `success`, then applies Drizzle migrations to production, then calls the hook. A failed migration means no deploy. The scheduled run is skipped (and logs why) when `main` has no commits in the last 7 days.

To ship a hotfix now, open the Actions tab, pick **Weekly production deploy**, and choose **Run workflow**. A manual run always migrates and deploys. It needs the `NETLIFY_BUILD_HOOK_URL` and `DOTENV_PRIVATE_KEY_PRODUCTION` repo secrets and fails if either is missing or the hook returns non-2xx. Production builds started from the Netlify UI are cancelled by the same gate, so use the workflow instead. GitHub disables scheduled workflows after 60 days without repo activity; re-enable it from the Actions tab if the weekly run stops appearing.

CI runs lint and unit tests before the build. E2e tests run as a separate job after CI passes.

Required repository secrets (Settings → Secrets → Actions):

- `E2E_DATABASE_URL`
- `NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `NUXT_CLERK_SECRET_KEY`
- `NUXT_CLERK_WEBHOOK_SECRET`
- `SENTRY_AUTH_TOKEN`
- `SENTRY_DSN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
