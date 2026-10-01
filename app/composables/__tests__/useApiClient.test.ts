import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as vue from "vue";

// useClerkAuth and useRequestFetch are Nuxt auto-imported globals. Stub them
// before importing the composable so the module resolves cleanly.
const mockGetToken = vi.fn();

function installClerkAuthStub(
  getTokenValue: (() => Promise<string | null>) | null,
) {
  vi.stubGlobal("useClerkAuth", () => ({
    getToken: vue.ref(getTokenValue),
    isSignedIn: vue.ref(getTokenValue !== null),
    isLoaded: vue.ref(true),
  }));
}

// Install the default stub (token resolvable) before importing
installClerkAuthStub(mockGetToken);

// useApiClient calls useRequestFetch() (not the plain global $fetch) so a
// relative /api/* path is dispatched in-process during SSR rather than as a
// real network round trip back to the server still handling the current
// request — see useApiClient.ts's own comment.
const mockFetch = vi.fn();
vi.stubGlobal("useRequestFetch", () => mockFetch);

// Import after globals are stubbed. The module is cached after first import;
// we re-stub useClerkAuth at call time (when useApiClient() is called), so
// the ref is always read from the active stub.
const { useApiClient } = await import("../useApiClient");
const { SSR_FETCH_TIMEOUT_MS } = await import("~/constants/ssr");

describe("useApiClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true });
    // Restore the default stub with a functional getToken before each test
    installClerkAuthStub(mockGetToken);
  });

  afterEach(() => {
    // Ensure the default stub is always in place after each test
    installClerkAuthStub(mockGetToken);
  });

  it("sets Authorization header when token is available", async () => {
    mockGetToken.mockResolvedValue("test-token");
    const { apiFetch } = useApiClient();

    await apiFetch("/api/health");

    const calledHeaders = mockFetch.mock.calls[0][1].headers as Headers;
    expect(calledHeaders.get("Authorization")).toBe("Bearer test-token");
  });

  it("omits Authorization header when token is null", async () => {
    mockGetToken.mockResolvedValue(null);
    const { apiFetch } = useApiClient();

    await apiFetch("/api/health");

    const calledHeaders = mockFetch.mock.calls[0][1].headers as Headers;
    expect(calledHeaders.get("Authorization")).toBeNull();
  });

  it("omits Authorization header when getToken.value is falsy (session not loaded)", async () => {
    installClerkAuthStub(null);
    const { apiFetch } = useApiClient();

    await apiFetch("/api/health");

    const calledHeaders = mockFetch.mock.calls[0][1].headers as Headers;
    expect(calledHeaders.get("Authorization")).toBeNull();
  });

  // #289: getToken.value is a real function reference during SSR (Clerk's
  // server middleware is disabled fleet-wide, but that doesn't make the ref
  // itself falsy) — *calling* it there never resolves, since Clerk has no
  // server context to resolve a token against. This hung every SSR request
  // to a guide/trip/profile detail page end-to-end before this guard was
  // added. Asserting getToken itself was never called (not just that the
  // header ends up empty) is what actually proves the hang is avoided.
  it("never calls getToken server-side, even when it's a real function", async () => {
    mockGetToken.mockResolvedValue("test-token");
    const { apiFetch } = useApiClient(true);

    await apiFetch("/api/health");

    expect(mockGetToken).not.toHaveBeenCalled();
    const calledHeaders = mockFetch.mock.calls[0][1].headers as Headers;
    expect(calledHeaders.get("Authorization")).toBeNull();
  });

  describe("SSR timeout (#304)", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    async function expectRejectsAtDeadline(
      outcome: Promise<unknown>,
      deadlineMs: number,
    ): Promise<void> {
      let settled = false;
      const assertion = expect(outcome).rejects.toMatchObject({
        name: "TimeoutError",
      });
      outcome
        .catch(() => {})
        .finally(() => {
          settled = true;
        });
      await vi.advanceTimersByTimeAsync(deadlineMs - 1);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await assertion;
    }

    it("rejects with a TimeoutError when the server-side fetch hangs", async () => {
      vi.useFakeTimers();
      mockFetch.mockReturnValue(new Promise(() => {}));
      const { apiFetch } = useApiClient(true);

      await expectRejectsAtDeadline(
        apiFetch("/api/guides/1"),
        SSR_FETCH_TIMEOUT_MS,
      );
    });

    it("does not let a caller-supplied timeout lift the SSR bound", async () => {
      vi.useFakeTimers();
      mockFetch.mockReturnValue(new Promise(() => {}));
      const { apiFetch } = useApiClient(true);

      await expectRejectsAtDeadline(
        apiFetch("/api/guides/1", { timeout: 60000 }),
        SSR_FETCH_TIMEOUT_MS,
      );
      expect(mockFetch.mock.calls[0][1].timeout).toBe(SSR_FETCH_TIMEOUT_MS);
    });

    it("lets a caller tighten the SSR bound", async () => {
      vi.useFakeTimers();
      mockFetch.mockReturnValue(new Promise(() => {}));
      const { apiFetch } = useApiClient(true);

      await expectRejectsAtDeadline(
        apiFetch("/api/guides/1", { timeout: 100 }),
        100,
      );
      expect(mockFetch.mock.calls[0][1].timeout).toBe(100);
    });

    it("treats timeout: 0 as unset rather than failing immediately", async () => {
      const { apiFetch } = useApiClient(true);

      await expect(apiFetch("/api/guides/1", { timeout: 0 })).resolves.toEqual({
        ok: true,
      });
      expect(mockFetch.mock.calls[0][1].timeout).toBe(SSR_FETCH_TIMEOUT_MS);
    });

    it("treats a negative timeout as unset", async () => {
      const { apiFetch } = useApiClient(true);

      await apiFetch("/api/guides/1", { timeout: -1 });

      expect(mockFetch.mock.calls[0][1].timeout).toBe(SSR_FETCH_TIMEOUT_MS);
    });

    it("disables ofetch retries server-side unless the caller opts in", async () => {
      const { apiFetch } = useApiClient(true);

      await apiFetch("/api/guides/1");
      await apiFetch("/api/guides/1", { retry: 2 });

      expect(mockFetch.mock.calls[0][1].retry).toBe(0);
      expect(mockFetch.mock.calls[1][1].retry).toBe(2);
    });

    it("hands ofetch its native timeout option server-side", async () => {
      const { apiFetch } = useApiClient(true);

      await apiFetch("/api/guides/1");

      expect(mockFetch.mock.calls[0][1].timeout).toBe(SSR_FETCH_TIMEOUT_MS);
    });

    it("applies no timeout client-side", async () => {
      vi.useFakeTimers();
      mockFetch.mockResolvedValue({ ok: true });
      const { apiFetch } = useApiClient(false);

      await apiFetch("/api/guides/1");

      expect(mockFetch.mock.calls[0][1].timeout).toBeUndefined();
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  it("preserves caller-supplied headers alongside the injected token", async () => {
    mockGetToken.mockResolvedValue("test-token");
    const { apiFetch } = useApiClient();

    await apiFetch("/api/health", {
      headers: { "X-Custom-Header": "custom-value" },
    });

    const calledHeaders = mockFetch.mock.calls[0][1].headers as Headers;
    expect(calledHeaders.get("Authorization")).toBe("Bearer test-token");
    expect(calledHeaders.get("X-Custom-Header")).toBe("custom-value");
  });

  it("handles caller headers as a Headers instance without dropping them", async () => {
    mockGetToken.mockResolvedValue("test-token");
    const { apiFetch } = useApiClient();

    const existingHeaders = new Headers({ Accept: "application/json" });
    await apiFetch("/api/health", {
      headers: existingHeaders as unknown as Record<string, string>,
    });

    const calledHeaders = mockFetch.mock.calls[0][1].headers as Headers;
    expect(calledHeaders.get("Accept")).toBe("application/json");
    expect(calledHeaders.get("Authorization")).toBe("Bearer test-token");
  });

  it("propagates $fetch rejection to the caller", async () => {
    mockGetToken.mockResolvedValue("test-token");
    mockFetch.mockRejectedValue(new Error("Network error"));
    const { apiFetch } = useApiClient();

    await expect(apiFetch("/api/health")).rejects.toThrow("Network error");
  });

  it("propagates getToken rejection to the caller", async () => {
    mockGetToken.mockRejectedValue(new Error("Token fetch failed"));
    const { apiFetch } = useApiClient();

    await expect(apiFetch("/api/health")).rejects.toThrow("Token fetch failed");
  });

  it("does not inject Authorization header for absolute external URLs", async () => {
    mockGetToken.mockResolvedValue("test-token");
    const { apiFetch } = useApiClient();

    await apiFetch("https://external.example.com/resource");

    const calledHeaders = mockFetch.mock.calls[0][1].headers as Headers;
    expect(calledHeaders.get("Authorization")).toBeNull();
  });

  it("does not inject Authorization header for protocol-relative URLs", async () => {
    mockGetToken.mockResolvedValue("test-token");
    const { apiFetch } = useApiClient();

    await apiFetch("//external.example.com/resource");

    const calledHeaders = mockFetch.mock.calls[0][1].headers as Headers;
    expect(calledHeaders.get("Authorization")).toBeNull();
  });

  it("does not inject Authorization header for non-/api/ internal paths", async () => {
    mockGetToken.mockResolvedValue("test-token");
    const { apiFetch } = useApiClient();

    await apiFetch("/some-page");

    const calledHeaders = mockFetch.mock.calls[0][1].headers as Headers;
    expect(calledHeaders.get("Authorization")).toBeNull();
  });

  it("passes extra options through to $fetch", async () => {
    mockGetToken.mockResolvedValue("test-token");
    const { apiFetch } = useApiClient();

    await apiFetch("/api/health", { method: "POST", body: { foo: "bar" } });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/health",
      expect.objectContaining({ method: "POST", body: { foo: "bar" } }),
    );
  });
});
