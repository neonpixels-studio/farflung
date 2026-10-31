import { describe, it, expect } from "vitest";
import { PLAN_LIMITS } from "../../../server/utils/planLimits";
import {
  entitledPlan,
  canSyncInstagram,
  canUsePublicProfile,
} from "../planFeatures";

const PLANS = ["drifter", "wanderer", "nomad"] as const;

describe("client plan features mirror the server's PLAN_LIMITS", () => {
  it.each(PLANS)("Instagram sync for %s", (plan) => {
    expect(canSyncInstagram(plan)).toBe(PLAN_LIMITS[plan].instagramSyncAllowed);
  });

  it.each(PLANS)("public profile for %s", (plan) => {
    expect(canUsePublicProfile(plan)).toBe(
      PLAN_LIMITS[plan].publicProfileAllowed,
    );
  });
});

describe("entitledPlan", () => {
  it("is the plan while the subscription is active", () => {
    expect(entitledPlan({ plan: "nomad", status: "active" })).toBe("nomad");
  });

  it.each(["past_due", "canceled"] as const)(
    "drops to drifter when the subscription is %s, as the server does",
    (status) => {
      expect(entitledPlan({ plan: "nomad", status })).toBe("drifter");
    },
  );
});
