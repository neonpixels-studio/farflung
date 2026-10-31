/**
 * Client-side mirror of the plan feature flags in server/utils/planLimits.ts,
 * used only to decide what the UI offers (a locked control with an upgrade
 * hint instead of a request that would 402). The server stays the authority;
 * tests pin these lists to PLAN_LIMITS so they can't drift.
 */
import type { Plan, UserSubscriptionDto } from "~/composables/useBilling";

const INSTAGRAM_SYNC_PLANS: readonly Plan[] = ["wanderer", "nomad"];
const PUBLIC_PROFILE_PLANS: readonly Plan[] = ["nomad"];

/**
 * The tier a subscription entitles its user to right now: its plan while
 * active, otherwise Drifter. Mirrors entitledPlan in
 * server/utils/subscriptions.ts.
 */
export function entitledPlan(
  subscription: Pick<UserSubscriptionDto, "plan" | "status">,
): Plan {
  return subscription.status === "active" ? subscription.plan : "drifter";
}

export function canSyncInstagram(plan: Plan): boolean {
  return INSTAGRAM_SYNC_PLANS.includes(plan);
}

export function canUsePublicProfile(plan: Plan): boolean {
  return PUBLIC_PROFILE_PLANS.includes(plan);
}
