import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { effectScope, ref, watchEffect } from "vue";
import { buildLoginPath } from "~/utils/authRedirect";

const isSignedIn = ref(false);
const isLoaded = ref(true);
const currentRoute = ref({ path: "/trips", fullPath: "/trips" });
const navigateToMock = vi.fn();

vi.stubGlobal("defineNuxtPlugin", (setup: () => void) => setup);
vi.stubGlobal("useRouter", () => ({ currentRoute }));
vi.stubGlobal("useAuth", () => ({ isSignedIn, isLoaded }));
vi.stubGlobal("watchEffect", watchEffect);
vi.stubGlobal("navigateTo", navigateToMock);

// Scoped so each test's watchEffect is stopped afterwards and can't fire on a
// later test's reactive state changes.
let scope = effectScope();

async function runPlugin(): Promise<void> {
  const module = await import("../auth-guard.client");
  scope.run(() => (module.default as unknown as () => void)());
}

describe("auth-guard client plugin", () => {
  beforeEach(() => {
    scope = effectScope();
    isSignedIn.value = false;
    isLoaded.value = true;
    currentRoute.value = { path: "/trips", fullPath: "/trips" };
    navigateToMock.mockClear();
  });

  afterEach(() => {
    scope.stop();
  });

  it("redirects a signed-out visitor on a protected route to /login with the full requested route", async () => {
    currentRoute.value = {
      path: "/trips/abc123",
      fullPath: "/trips/abc123?tab=stops#day-2",
    };

    await runPlugin();

    expect(navigateToMock).toHaveBeenCalledWith(
      buildLoginPath("/trips/abc123?tab=stops#day-2"),
    );
  });

  it("does not redirect while Clerk has not loaded", async () => {
    isLoaded.value = false;

    await runPlugin();

    expect(navigateToMock).not.toHaveBeenCalled();
  });

  it("does not redirect a signed-out visitor on a public route", async () => {
    currentRoute.value = { path: "/pricing", fullPath: "/pricing" };

    await runPlugin();

    expect(navigateToMock).not.toHaveBeenCalled();
  });

  it("does not redirect a signed-in visitor", async () => {
    isSignedIn.value = true;

    await runPlugin();

    expect(navigateToMock).not.toHaveBeenCalled();
  });
});
