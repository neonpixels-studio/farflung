import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  installNitroGlobals,
  unwrapHandler,
  makeSelectChain,
  makeInsertChain,
} from "./_helpers";

installNitroGlobals();

vi.mock("../../../server/utils/auth", () => ({
  ensureUser: vi.fn(),
  requireUser: vi.fn(),
}));

vi.mock("../../../server/utils/db-helpers", () => ({
  requireString: vi.fn((value: unknown, fieldName: string) => {
    if (typeof value !== "string" || value.trim() === "") {
      throw createError({
        statusCode: 400,
        statusMessage: `${fieldName} is required and must be a non-empty string`,
      });
    }
  }),
}));

vi.mock("../../../server/db/index", () => ({
  getDb: vi.fn(),
}));

import { ensureUser } from "../../../server/utils/auth";
import { getDb } from "../../../server/db/index";
import { notifications } from "../../../server/db/schema";

const mockEnsureUser = vi.mocked(ensureUser);
const mockGetDb = vi.mocked(getDb);
const mockReadBody = vi.mocked(
  readBody as (event: unknown) => Promise<unknown>,
);

const handler = await import("../../../server/api/follows/index.post");
const callHandler = () => unwrapHandler(handler as Record<string, unknown>)({});

describe("POST /api/follows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok:true when a valid follow is created", async () => {
    mockEnsureUser.mockResolvedValue("follower-1");
    mockReadBody.mockResolvedValue({ followeeId: "followee-1" });

    const selectChain = makeSelectChain([{ id: "followee-1" }]);
    const insertChain = makeInsertChain();
    mockGetDb.mockReturnValue({
      ...selectChain,
      ...insertChain,
    } as unknown as ReturnType<typeof getDb>);

    const result = await callHandler();
    expect(result).toEqual({ ok: true });
  });

  it("is idempotent: re-following an already-followed user does not throw", async () => {
    mockEnsureUser.mockResolvedValue("follower-1");
    mockReadBody.mockResolvedValue({ followeeId: "followee-1" });

    const selectChain = makeSelectChain([{ id: "followee-1" }]);
    // Pass empty array to simulate onConflictDoNothing skipping the insert
    const insertChain = makeInsertChain([]);
    mockGetDb.mockReturnValue({
      ...selectChain,
      ...insertChain,
    } as unknown as ReturnType<typeof getDb>);

    await expect(callHandler()).resolves.toEqual({ ok: true });
  });

  it("throws 422 when the follower tries to follow themselves", async () => {
    mockEnsureUser.mockResolvedValue("user-1");
    mockReadBody.mockResolvedValue({ followeeId: "user-1" });

    mockGetDb.mockReturnValue({} as unknown as ReturnType<typeof getDb>);

    await expect(callHandler()).rejects.toMatchObject({ statusCode: 422 });
  });

  it("throws 404 when the followee user does not exist", async () => {
    mockEnsureUser.mockResolvedValue("follower-1");
    mockReadBody.mockResolvedValue({ followeeId: "nonexistent-user" });

    const selectChain = makeSelectChain([]);
    mockGetDb.mockReturnValue(
      selectChain as unknown as ReturnType<typeof getDb>,
    );

    await expect(callHandler()).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws 400 when followeeId is missing from the body", async () => {
    mockEnsureUser.mockResolvedValue("follower-1");
    mockReadBody.mockResolvedValue({});

    mockGetDb.mockReturnValue({} as unknown as ReturnType<typeof getDb>);

    await expect(callHandler()).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when followeeId is an empty string", async () => {
    mockEnsureUser.mockResolvedValue("follower-1");
    mockReadBody.mockResolvedValue({ followeeId: "" });

    mockGetDb.mockReturnValue({} as unknown as ReturnType<typeof getDb>);

    await expect(callHandler()).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 401 when the user is not authenticated", async () => {
    mockEnsureUser.mockRejectedValue(
      createError({ statusCode: 401, statusMessage: "Unauthorized" }),
    );
    mockReadBody.mockResolvedValue({ followeeId: "followee-1" });

    await expect(callHandler()).rejects.toMatchObject({ statusCode: 401 });
  });

  it("creates a notification with the follower recorded as the actor", async () => {
    mockEnsureUser.mockResolvedValue("follower-1");
    mockReadBody.mockResolvedValue({ followeeId: "followee-1" });

    const selectChain = makeSelectChain([{ id: "followee-1" }]);
    const insertChain = makeInsertChain();
    mockGetDb.mockReturnValue({
      ...selectChain,
      ...insertChain,
    } as unknown as ReturnType<typeof getDb>);

    await callHandler();

    // insert() is called twice: once for the follows row, once (inside
    // createNotification) for the notification row. Both calls share the
    // same mocked .values() function, so its call history holds both
    // payloads in order.
    const valuesMock = insertChain.insert.mock.results[0]!.value.values;
    expect(valuesMock.mock.calls).toHaveLength(2);
    const notificationPayload = valuesMock.mock.calls[1]![0] as Record<
      string,
      unknown
    >;
    expect(notificationPayload.userId).toBe("followee-1");
    expect(notificationPayload.type).toBe("new_follower");
    expect(notificationPayload.actorId).toBe("follower-1");
    // The second insert() call must target the notifications table — without
    // this, an insert().values() call carrying the right-looking payload
    // could still be writing to the wrong table.
    expect(insertChain.insert.mock.calls[1]?.[0]).toBe(notifications);
  });

  it("does not create a notification when the follow already existed (onConflictDoNothing)", async () => {
    mockEnsureUser.mockResolvedValue("follower-1");
    mockReadBody.mockResolvedValue({ followeeId: "followee-1" });

    const selectChain = makeSelectChain([{ id: "followee-1" }]);
    const insertChain = makeInsertChain([]);
    mockGetDb.mockReturnValue({
      ...selectChain,
      ...insertChain,
    } as unknown as ReturnType<typeof getDb>);

    await callHandler();

    const valuesMock = insertChain.insert.mock.results[0]!.value.values;
    // Only the follows-row insert should have happened; createNotification
    // is skipped entirely when the follow was already there.
    expect(valuesMock.mock.calls).toHaveLength(1);
  });
});
