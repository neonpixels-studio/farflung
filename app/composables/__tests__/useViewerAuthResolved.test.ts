import { describe, it, expect, vi, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, ref } from "vue";
import { useViewerAuthResolved } from "../useViewerAuthResolved";
import { CLERK_BOOTSTRAP_TIMEOUT_MS } from "../useClerkGatedFetch";

// Mounts a bare host component so onMounted/onUnmounted (used internally by
// useViewerAuthResolved) have a real component instance to attach to.
function mountHost(isClerkLoaded: ReturnType<typeof ref<boolean>>) {
  let viewerAuthResolved: ReturnType<
    typeof useViewerAuthResolved
  >["viewerAuthResolved"];
  const wrapper = mount(
    defineComponent({
      setup() {
        ({ viewerAuthResolved } = useViewerAuthResolved(isClerkLoaded));
        return () => null;
      },
    }),
  );
  return { wrapper, viewerAuthResolved: viewerAuthResolved! };
}

describe("useViewerAuthResolved", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves immediately once isClerkLoaded is already true at mount", () => {
    const isClerkLoaded = ref(true);
    const { viewerAuthResolved } = mountHost(isClerkLoaded);

    expect(viewerAuthResolved.value).toBe(true);
  });

  it("stays unresolved while isClerkLoaded is false and the bootstrap grace period hasn't lapsed", () => {
    vi.useFakeTimers();
    const isClerkLoaded = ref(false);
    const { viewerAuthResolved } = mountHost(isClerkLoaded);

    expect(viewerAuthResolved.value).toBe(false);
  });

  it("resolves once isClerkLoaded flips true before the grace period lapses", async () => {
    const isClerkLoaded = ref(false);
    const { viewerAuthResolved } = mountHost(isClerkLoaded);

    isClerkLoaded.value = true;
    await Promise.resolve();

    expect(viewerAuthResolved.value).toBe(true);
  });

  // A public resource must still render even if Clerk's script never loads
  // at all (blocked by an ad blocker, a flaky CDN) — this bound is what
  // callers rely on to eventually show a signed-out UI instead of hanging
  // forever on "not yet resolved".
  it("resolves once the bootstrap grace period lapses, even if isClerkLoaded never flips true", async () => {
    vi.useFakeTimers();
    const isClerkLoaded = ref(false);
    const { viewerAuthResolved } = mountHost(isClerkLoaded);

    await vi.advanceTimersByTimeAsync(CLERK_BOOTSTRAP_TIMEOUT_MS);

    expect(viewerAuthResolved.value).toBe(true);
  });

  it("clears its timer on unmount, so a torn-down page's timer never fires later", async () => {
    vi.useFakeTimers();
    const isClerkLoaded = ref(false);
    const { wrapper, viewerAuthResolved } = mountHost(isClerkLoaded);

    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(CLERK_BOOTSTRAP_TIMEOUT_MS);

    expect(viewerAuthResolved.value).toBe(false);
  });
});
