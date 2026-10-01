import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rejectAfterTimeout } from "../rejectAfterTimeout";

describe("rejectAfterTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves with the pending value when it settles in time", async () => {
    const result = await rejectAfterTimeout(Promise.resolve("ok"), 1000);

    expect(result).toBe("ok");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("passes through the pending rejection unchanged", async () => {
    await expect(
      rejectAfterTimeout(Promise.reject(new Error("boom")), 1000),
    ).rejects.toThrow("boom");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects with a TimeoutError when pending never settles", async () => {
    const outcome = rejectAfterTimeout(new Promise(() => {}), 1000);
    const assertion = expect(outcome).rejects.toMatchObject({
      name: "TimeoutError",
    });

    await vi.advanceTimersByTimeAsync(1000);

    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("resolves and clears the timer when pending settles just before the deadline", async () => {
    let resolvePending: (value: string) => void = () => {};
    const pending = new Promise<string>((resolve) => {
      resolvePending = resolve;
    });
    const outcome = rejectAfterTimeout(pending, 1000);

    await vi.advanceTimersByTimeAsync(999);
    resolvePending("late but ok");

    await expect(outcome).resolves.toBe("late but ok");
    expect(vi.getTimerCount()).toBe(0);
  });
});
