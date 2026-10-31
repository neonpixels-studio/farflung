/**
 * GET /api/billing/checkout
 *
 * Creates a Stripe Checkout Session for the requested plan tier + billing
 * cycle and returns its hosted URL. Returned rather than redirected to because
 * this route needs the Clerk Bearer token, which a full-page navigation can't
 * send; see useBillingRedirect.
 */

import { ensureUser } from "../../utils/auth";
import {
  getStripeCustomerIdForUser,
  getSubscriptionForUser,
} from "../../utils/subscriptions";
import { PLAN, SUBSCRIPTION_STATUS } from "../../db/schema";
import {
  createCheckoutSession,
  getPriceId,
  type PlanTier,
  type BillingCycleOption,
} from "../../utils/stripe";

const VALID_TIERS: readonly PlanTier[] = ["wanderer", "nomad"];
const VALID_CYCLES: readonly BillingCycleOption[] = ["monthly", "yearly"];
const DEFAULT_SUCCESS_PATH = "/settings#billing";
const CANCEL_PATH = "/pricing";

function requireAppOrigin(): string {
  const origin =
    process.env.NUXT_PUBLIC_SITE_ORIGIN || useRuntimeConfig().public.siteOrigin;
  if (!origin) {
    throw createError({
      statusCode: 500,
      statusMessage: "NUXT_PUBLIC_SITE_ORIGIN is not configured",
    });
  }
  return origin;
}

function parseTier(value: unknown): PlanTier {
  if (typeof value === "string" && VALID_TIERS.includes(value as PlanTier)) {
    return value as PlanTier;
  }
  throw createError({ statusCode: 400, statusMessage: "Invalid plan tier" });
}

function parseCycle(value: unknown): BillingCycleOption {
  if (
    typeof value === "string" &&
    VALID_CYCLES.includes(value as BillingCycleOption)
  ) {
    return value as BillingCycleOption;
  }
  throw createError({
    statusCode: 400,
    statusMessage: "Invalid billing cycle",
  });
}

// Only a same-origin relative path is accepted, and "//host/..." is rejected
// even though it starts with "/" — browsers treat a protocol-relative URL as
// an absolute one, which would otherwise let this query param redirect to an
// external site after checkout (open-redirect).
function parseRedirectTo(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  if (!value.startsWith("/") || value.startsWith("//")) {
    return null;
  }
  return value;
}

// A user whose row already reflects a live paid subscription (active or
// past_due — past_due still has a real Stripe subscription, just failing
// payment) must manage it through the Billing Portal instead of starting a
// second Checkout Session: Stripe would happily create a second subscription
// on the same customer, silently double-billing them, since a customer can
// hold more than one active subscription at once.
function assertNotAlreadySubscribed(subscription: {
  plan: string;
  status: string;
}): void {
  const alreadySubscribed =
    subscription.plan !== PLAN.DRIFTER &&
    subscription.status !== SUBSCRIPTION_STATUS.CANCELED;
  if (!alreadySubscribed) {
    return;
  }
  throw createError({
    statusCode: 409,
    statusMessage:
      "You already have a subscription — manage it from Settings instead.",
  });
}

export default defineEventHandler(async (event) => {
  const userId = await ensureUser(event);
  const query = getQuery(event);
  const tier = parseTier(query.tier);
  const cycle = parseCycle(query.cycle);
  const redirectTo = parseRedirectTo(query.redirectTo);

  const priceId = getPriceId(tier, cycle);
  if (!priceId) {
    throw createError({
      statusCode: 400,
      statusMessage: `Checkout for the ${tier} plan (${cycle}) is not configured`,
    });
  }

  const currentSubscription = await getSubscriptionForUser(userId);
  assertNotAlreadySubscribed(currentSubscription);

  const origin = requireAppOrigin();
  const existingCustomerId = await getStripeCustomerIdForUser(userId);

  const session = await createCheckoutSession({
    userId,
    priceId,
    existingCustomerId,
    successUrl: `${origin}${redirectTo ?? DEFAULT_SUCCESS_PATH}`,
    cancelUrl: `${origin}${CANCEL_PATH}`,
  });

  if (!session.url) {
    throw createError({
      statusCode: 502,
      statusMessage: "Stripe did not return a checkout URL",
    });
  }

  return { url: session.url };
});
