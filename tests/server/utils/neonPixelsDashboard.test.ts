import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  NEON_PIXELS_FEEDBACK_ENDPOINT,
  requireNeonPixelsDashboardToken,
  sendFeedback,
} from "../../../server/utils/neonPixelsDashboard";

const payload = {
  message: "The export button does nothing.",
  email: "reader@example.com",
  url: "https://farflung.io/settings",
};

describe("sendFeedback", () => {
  it("POSTs the payload as JSON with the bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null));

    await sendFeedback(payload, "npk_test", fetchMock);

    expect(fetchMock).toHaveBeenCalledWith(NEON_PIXELS_FEEDBACK_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: "Bearer npk_test",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  });

  it("throws when the dashboard responds with an error status", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 401 }));

    await expect(sendFeedback(payload, "npk_bad", fetchMock)).rejects.toThrow(
      "Feedback submission failed (401)",
    );
  });
});

describe("requireNeonPixelsDashboardToken", () => {
  const originalToken = process.env.NEON_PIXELS_DASHBOARD_TOKEN;

  beforeEach(() => {
    delete process.env.NEON_PIXELS_DASHBOARD_TOKEN;
    vi.mocked(useRuntimeConfig).mockReturnValue({
      neonPixelsDashboardToken: "",
    } as unknown as ReturnType<typeof useRuntimeConfig>);
  });

  afterEach(() => {
    process.env.NEON_PIXELS_DASHBOARD_TOKEN = originalToken;
    vi.mocked(useRuntimeConfig).mockReset();
  });

  it("prefers the raw environment variable", () => {
    process.env.NEON_PIXELS_DASHBOARD_TOKEN = "npk_env";
    expect(requireNeonPixelsDashboardToken()).toBe("npk_env");
  });

  it("falls back to runtime config", () => {
    vi.mocked(useRuntimeConfig).mockReturnValue({
      neonPixelsDashboardToken: "npk_config",
    } as unknown as ReturnType<typeof useRuntimeConfig>);
    expect(requireNeonPixelsDashboardToken()).toBe("npk_config");
  });

  it("throws when the token is not configured", () => {
    expect(() => requireNeonPixelsDashboardToken()).toThrow(
      "NEON_PIXELS_DASHBOARD_TOKEN is not set",
    );
  });
});
