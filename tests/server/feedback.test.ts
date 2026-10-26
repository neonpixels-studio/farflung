import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubGlobal(
  "defineEventHandler",
  (handler: (event: unknown) => unknown) => handler,
);
vi.stubGlobal(
  "createError",
  (options: { statusCode: number; statusMessage: string }) => {
    const error = new Error(options.statusMessage) as Error & {
      statusCode: number;
      statusMessage: string;
    };
    error.statusCode = options.statusCode;
    error.statusMessage = options.statusMessage;
    return error;
  },
);
const readBodyMock = vi.fn();
vi.stubGlobal("readBody", readBodyMock);

vi.mock("../../server/utils/auth", () => ({
  requireUser: vi.fn(),
}));

vi.mock("../../server/utils/neonPixelsDashboard", () => ({
  requireNeonPixelsDashboardToken: vi.fn(),
  sendFeedback: vi.fn(),
}));

import { requireUser } from "../../server/utils/auth";
import {
  requireNeonPixelsDashboardToken,
  sendFeedback,
} from "../../server/utils/neonPixelsDashboard";

const mockRequireUser = vi.mocked(requireUser);
const mockRequireToken = vi.mocked(requireNeonPixelsDashboardToken);
const mockSendFeedback = vi.mocked(sendFeedback);

const { default: handler } =
  (await import("../../server/api/feedback.post")) as unknown as {
    default: (event: unknown) => Promise<unknown>;
  };

const validBody = {
  message: "  The export button does nothing.  ",
  email: "reader@example.com",
  url: "https://farflung.io/settings",
};

describe("POST /api/feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockReturnValue("user-abc");
    mockRequireToken.mockReturnValue("npk_test");
    mockSendFeedback.mockResolvedValue(undefined);
    readBodyMock.mockResolvedValue(validBody);
  });

  it("forwards trimmed feedback to the dashboard with the server token", async () => {
    const result = await handler({});

    expect(result).toEqual({ ok: true });
    expect(mockSendFeedback).toHaveBeenCalledWith(
      {
        message: "The export button does nothing.",
        email: "reader@example.com",
        url: "https://farflung.io/settings",
      },
      "npk_test",
    );
  });

  it("rejects unauthenticated requests before reading the body", async () => {
    mockRequireUser.mockImplementation(() => {
      throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
    });

    await expect(handler({})).rejects.toMatchObject({ statusCode: 401 });
    expect(readBodyMock).not.toHaveBeenCalled();
    expect(mockSendFeedback).not.toHaveBeenCalled();
  });

  it.each(["message", "email", "url"] as const)(
    "returns 400 when %s is missing",
    async (field) => {
      readBodyMock.mockResolvedValue({ ...validBody, [field]: "  " });

      await expect(handler({})).rejects.toMatchObject({ statusCode: 400 });
      expect(mockSendFeedback).not.toHaveBeenCalled();
    },
  );

  it("returns 400 when the message is too long", async () => {
    readBodyMock.mockResolvedValue({
      ...validBody,
      message: "a".repeat(5001),
    });

    await expect(handler({})).rejects.toMatchObject({ statusCode: 400 });
  });

  it("returns 400 for a non-object body", async () => {
    readBodyMock.mockResolvedValue(["nope"]);

    await expect(handler({})).rejects.toMatchObject({ statusCode: 400 });
  });

  it("returns 502 when the dashboard rejects the submission", async () => {
    mockSendFeedback.mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(handler({})).rejects.toMatchObject({ statusCode: 502 });
  });

  it("surfaces a missing token as a server error, not a 502", async () => {
    mockRequireToken.mockImplementation(() => {
      throw new Error("NEON_PIXELS_DASHBOARD_TOKEN is not set");
    });

    await expect(handler({})).rejects.toThrow(
      "NEON_PIXELS_DASHBOARD_TOKEN is not set",
    );
    expect(mockSendFeedback).not.toHaveBeenCalled();
  });
});
