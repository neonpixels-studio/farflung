/**
 * GET /api/billing/portal
 *
 * Creates a Stripe Billing Portal session for the authenticated user's
 * existing Stripe customer and returns its URL so they can view invoices,
 * update their payment method, or cancel. Same convention as
 * server/api/billing/checkout.get.ts.
 */

import { ensureUser } from "../../utils/auth";
import { getStripeCustomerIdForUser } from "../../utils/subscriptions";
import { createBillingPortalSession } from "../../utils/stripe";

const RETURN_PATH = "/settings#billing";

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

export default defineEventHandler(async (event) => {
  const userId = await ensureUser(event);
  const customerId = await getStripeCustomerIdForUser(userId);
  if (!customerId) {
    throw createError({
      statusCode: 404,
      statusMessage: "No billing account found for this user",
    });
  }

  const origin = requireAppOrigin();
  const session = await createBillingPortalSession({
    customerId,
    returnUrl: `${origin}${RETURN_PATH}`,
  });

  if (!session.url) {
    throw createError({
      statusCode: 502,
      statusMessage: "Stripe did not return a billing portal URL",
    });
  }

  return { url: session.url };
});
