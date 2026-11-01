import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { nextTick, ref } from "vue";
import {
  HANDLE_CHECK_DEBOUNCE_MS,
  useHandleAvailability,
} from "../useHandleAvailability";

const mockApiFetch = vi.fn();

vi.mock("~/composables/useApiClient", () => ({
  useApiClient: () => ({ apiFetch: mockApiFetch }),
}));

vi.stubGlobal("onBeforeUnmount", vi.fn());

async function typeHandle(
  handle: ReturnType<typeof ref<string>>,
  value: string,
): Promise<void> {
  handle.value = value;
  await nextTick();
}

async function settleDebounce(): Promise<void> {
  await vi.advanceTimersByTimeAsync(HANDLE_CHECK_DEBOUNCE_MS);
}

describe("useHandleAvailability", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(saved: string | null = null) {
    const handle = ref("");
    const savedHandle = ref<string | null>(saved);
    return { handle, ...useHandleAvailability(handle, savedHandle) };
  }

  it("starts idle", () => {
    expect(setup().status.value).toBe("idle");
  });

  it("reports format problems immediately, without a request", async () => {
    const { handle, status, message } = setup();

    await typeHandle(handle, "no spaces");

    expect(status.value).toBe("unavailable");
    expect(message.value).toContain("letters, numbers");
    await settleDebounce();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("reports a reserved word without a request", async () => {
    const { handle, status, message } = setup();

    await typeHandle(handle, "settings");

    expect(status.value).toBe("unavailable");
    expect(message.value).toBe("That handle is reserved");
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("debounces the availability request and marks a free handle available", async () => {
    mockApiFetch.mockResolvedValue({ available: true, message: null });
    const { handle, status } = setup();

    await typeHandle(handle, "gri");
    await typeHandle(handle, "grim");
    await typeHandle(handle, "grimicorn");
    expect(status.value).toBe("checking");
    expect(mockApiFetch).not.toHaveBeenCalled();

    await settleDebounce();

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/handles/grimicorn/availability",
    );
    expect(status.value).toBe("available");
  });

  it("reports a taken handle with the server's message", async () => {
    mockApiFetch.mockResolvedValue({
      available: false,
      message: "That handle is already taken",
    });
    const { handle, status, message } = setup();

    await typeHandle(handle, "taken-one");
    await settleDebounce();

    expect(status.value).toBe("unavailable");
    expect(message.value).toBe("That handle is already taken");
  });

  it("encodes the handle in the request path", async () => {
    mockApiFetch.mockResolvedValue({ available: true, message: null });
    const { handle } = setup();

    await typeHandle(handle, "a_b-c");
    await settleDebounce();

    expect(mockApiFetch.mock.calls[0]![0]).toBe(
      "/api/handles/a_b-c/availability",
    );
  });

  it("does not check the user's own saved handle, in any casing", async () => {
    const { handle, status } = setup("Grimicorn");

    await typeHandle(handle, "grimicorn");
    await settleDebounce();

    expect(status.value).toBe("idle");
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("returns to idle when the field is cleared", async () => {
    mockApiFetch.mockResolvedValue({ available: true, message: null });
    const { handle, status } = setup();
    await typeHandle(handle, "grimicorn");
    await settleDebounce();

    await typeHandle(handle, "   ");

    expect(status.value).toBe("idle");
  });

  it("surfaces a failed check as an error state", async () => {
    mockApiFetch.mockRejectedValue({ data: { statusMessage: "Server down" } });
    const { handle, status, message } = setup();

    await typeHandle(handle, "grimicorn");
    await settleDebounce();

    expect(status.value).toBe("error");
    expect(message.value).toBe("Server down");
  });

  it("discards a stale response when the user kept typing", async () => {
    let resolveFirst: (value: unknown) => void = () => {};
    mockApiFetch
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce({ available: false, message: "taken" });
    const { handle, status } = setup();

    await typeHandle(handle, "first-handle");
    await settleDebounce();
    await typeHandle(handle, "second-handle");
    await settleDebounce();
    expect(status.value).toBe("unavailable");

    resolveFirst({ available: true, message: null });
    await vi.advanceTimersByTimeAsync(0);

    // The late "available" for first-handle must not overwrite second-handle.
    expect(status.value).toBe("unavailable");
  });
});
