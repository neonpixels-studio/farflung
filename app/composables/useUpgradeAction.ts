import { useBilling } from "~/composables/useBilling";

type UpgradeAction = "pricing" | "portal" | null;

// Wanderers already subscribe, so checkout would refuse them and plan changes
// go through the Stripe portal instead.
const UPGRADE_ACTION_BY_PLAN: Record<string, UpgradeAction> = {
  drifter: "pricing",
  wanderer: "portal",
  nomad: null,
};

/**
 * What a signed-in visitor's "upgrade" control should do. Stays null until the
 * real plan loads so a Nomad never sees "upgrade" flash from the Drifter default.
 */
export function useUpgradeAction() {
  const { isSignedIn } = useClerkAuth();
  const { subscription, fetchSubscription } = useBilling();
  const hasLoadedPlan = ref(false);

  async function loadPlan(signedIn: boolean): Promise<void> {
    if (!signedIn) {
      return;
    }
    await fetchSubscription();
    hasLoadedPlan.value = true;
  }

  onMounted(() => {
    watch(isSignedIn, loadPlan, { immediate: true });
  });

  const upgradeAction = computed<UpgradeAction>(() => {
    if (!hasLoadedPlan.value) {
      return null;
    }
    return UPGRADE_ACTION_BY_PLAN[subscription.value.plan] ?? null;
  });

  return { upgradeAction };
}
