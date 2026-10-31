import Stripe from "stripe";

export type PlanTier = "wanderer" | "nomad";
export type BillingCycleOption = "monthly" | "yearly";

let cachedStripeClient: Stripe | null = null;

export function requireStripeSecretKey(): string {
  const secretKey =
    process.env.STRIPE_SECRET_KEY || useRuntimeConfig().stripeSecretKey;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return secretKey;
}

/**
 * Returns a cached Stripe client.
 * Isolated here (alongside the rest of this file) so every Stripe API call
 * shares one client instance and the dependency can be mocked in tests
 * without any network access — see server/utils/clerk.ts for the same pattern
 * applied to the Clerk backend SDK.
 */
export function getStripeClient(): Stripe {
  if (cachedStripeClient) {
    return cachedStripeClient;
  }
  // No apiVersion pinned: the installed `stripe` package pins its own default
  // API version internally, which is the standard recommendation for most
  // integrations (see Stripe Node SDK docs) and one less version string to
  // keep in sync by hand.
  cachedStripeClient = new Stripe(requireStripeSecretKey());
  return cachedStripeClient;
}

// Maps this app's plan tier + billing cycle vocabulary to where its Stripe
// Price ID is read from: a raw env var (which still wins if set at runtime) and
// the runtimeConfig key it bakes into at build time. The Price ID stays
// server-only (never reaches the client); the /api/billing/config route exposes
// only a "configured" boolean per tier/cycle so checkout buttons know whether
// to render disabled.
const PRICE_ID_SOURCES: Record<
  PlanTier,
  Record<BillingCycleOption, { envVar: string; configKey: string }>
> = {
  wanderer: {
    monthly: {
      envVar: "STRIPE_PRICE_WANDERER_MONTHLY",
      configKey: "stripePriceWandererMonthly",
    },
    yearly: {
      envVar: "STRIPE_PRICE_WANDERER_YEARLY",
      configKey: "stripePriceWandererYearly",
    },
  },
  nomad: {
    monthly: {
      envVar: "STRIPE_PRICE_NOMAD_MONTHLY",
      configKey: "stripePriceNomadMonthly",
    },
    yearly: {
      envVar: "STRIPE_PRICE_NOMAD_YEARLY",
      configKey: "stripePriceNomadYearly",
    },
  },
};

/** Returns the configured Stripe Price ID for a tier + cycle, or null if unset. */
export function getPriceId(
  tier: PlanTier,
  cycle: BillingCycleOption,
): string | null {
  const { envVar, configKey } = PRICE_ID_SOURCES[tier][cycle];
  const config = useRuntimeConfig() as unknown as Record<string, string>;
  return process.env[envVar] || config[configKey] || null;
}

// Flat list of every tier/cycle combination, derived from PRICE_ID_SOURCES so
// it can never drift out of sync with it. Used by mapPriceIdToPlan as a single
// flat pass instead of a nested loop.
const ALL_TIER_CYCLES: ReadonlyArray<{
  tier: PlanTier;
  cycle: BillingCycleOption;
}> = Object.keys(PRICE_ID_SOURCES).flatMap((tier) =>
  Object.keys(PRICE_ID_SOURCES[tier as PlanTier]).map((cycle) => ({
    tier: tier as PlanTier,
    cycle: cycle as BillingCycleOption,
  })),
);

/**
 * Reverse lookup from a Stripe Price ID (as it appears on a subscription
 * item) back to this app's plan tier + billing cycle. Built once per call
 * from the same env vars getPriceId reads, so the two can never drift apart.
 */
export function mapPriceIdToPlan(
  priceId: string | null | undefined,
): { plan: PlanTier; cycle: BillingCycleOption } | null {
  if (!priceId) {
    return null;
  }
  const match = ALL_TIER_CYCLES.find(
    ({ tier, cycle }) => getPriceId(tier, cycle) === priceId,
  );
  return match ? { plan: match.tier, cycle: match.cycle } : null;
}

export const TRIAL_PERIOD_DAYS = 14;

export interface CreateCheckoutSessionParams {
  userId: string;
  priceId: string;
  existingCustomerId: string | null;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Creates a Stripe Checkout Session for a new subscription and returns its
 * hosted URL. `subscription_data.metadata.userId` is the sync key every
 * subsequent `customer.subscription.*` webhook event carries directly on the
 * Subscription object — see server/utils/subscriptions.ts — so no separate
 * customer-id lookup is needed to attribute those events back to this user.
 * Reuses `existingCustomerId` when the user already has a Stripe customer
 * (e.g. a past subscriber resubscribing) instead of creating a duplicate one.
 */
// Only first-time customers get a trial, so a past subscriber can't restart one
// by cancelling and resubscribing.
function trialDaysFor(existingCustomerId: string | null | undefined) {
  return existingCustomerId ? undefined : TRIAL_PERIOD_DAYS;
}

export async function createCheckoutSession(
  params: CreateCheckoutSessionParams,
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeClient();
  return stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: params.priceId, quantity: 1 }],
    client_reference_id: params.userId,
    customer: params.existingCustomerId ?? undefined,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    subscription_data: {
      metadata: { userId: params.userId },
      trial_period_days: trialDaysFor(params.existingCustomerId),
    },
  });
}

export interface CreateBillingPortalSessionParams {
  customerId: string;
  returnUrl: string;
}

/** Creates a Stripe Billing Portal session and returns its hosted URL. */
export async function createBillingPortalSession(
  params: CreateBillingPortalSessionParams,
): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripeClient();
  return stripe.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  });
}

export function requireStripeWebhookSecret(): string {
  const secret =
    process.env.STRIPE_WEBHOOK_SECRET || useRuntimeConfig().stripeWebhookSecret;
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  }
  return secret;
}

/**
 * Verifies a Stripe webhook signature and returns the parsed event.
 * Isolated here so callers can stub this seam in tests without network
 * access — mirrors server/utils/svix.ts for the Clerk webhook.
 */
export function constructStripeEvent(
  rawBody: string,
  signature: string,
  secret: string,
): Stripe.Event {
  const stripe = getStripeClient();
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}
