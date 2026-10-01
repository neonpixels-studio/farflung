import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { buildLoginPath } from "~/utils/authRedirect";

const isSignedIn = ref(false);
const isLoaded = ref(true);
const navigateToMock = vi.fn((path: string) => path);

vi.stubGlobal("defineNuxtRouteMiddleware", (handler: unknown) => handler);
vi.stubGlobal("useAuth", () => ({ isSignedIn, isLoaded }));
vi.stubGlobal("navigateTo", navigateToMock);

type Middleware = (to: { fullPath: string }) => unknown;

async function loadMiddleware(): Promise<Middleware> {
  const module = await import("../auth");
  return module.default as unknown as Middleware;
}

describe("auth route middleware", () => {
  beforeEach(() => {
    isSignedIn.value = false;
    isLoaded.value = true;
    navigateToMock.mockClear();
  });

  it("redirects a signed-out visitor to /login carrying the requested route", async () => {
    const middleware = await loadMiddleware();

    middleware({ fullPath: "/trips/abc123?tab=stops" });

    expect(navigateToMock).toHaveBeenCalledWith(
      buildLoginPath("/trips/abc123?tab=stops"),
    );
    const redirectPath = navigateToMock.mock.calls[0]?.[0] as string;
    expect(
      new URL(redirectPath, "http://localhost").searchParams.get("return_to"),
    ).toBe("/trips/abc123?tab=stops");
  });

  it("does nothing while Clerk has not loaded", async () => {
    isLoaded.value = false;
    const middleware = await loadMiddleware();

    middleware({ fullPath: "/trips" });

    expect(navigateToMock).not.toHaveBeenCalled();
  });

  it("does nothing for a signed-in visitor", async () => {
    isSignedIn.value = true;
    const middleware = await loadMiddleware();

    middleware({ fullPath: "/trips" });

    expect(navigateToMock).not.toHaveBeenCalled();
  });
});
