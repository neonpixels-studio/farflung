/**
 * Unit tests for PATCH /api/account/name
 *
 * Clerk and the database are mocked so no network or credentials are needed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  stubCreateError,
  stubDefineEventHandler,
  buildAccountEvent,
  callHandler,
} from "./_helpers";

const {
  mockEnsureUser,
  mockClerkUpdateName,
  mockReadBody,
  mockGetDb,
  mockInsert,
  mockValues,
  mockOnConflictDoUpdate,
} = vi.hoisted(() => {
  const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const mockValues = vi
    .fn()
    .mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
  const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
  return {
    mockEnsureUser: vi.fn(),
    mockClerkUpdateName: vi.fn(),
    mockReadBody: vi.fn(),
    mockGetDb: vi.fn(() => ({ insert: mockInsert })),
    mockInsert,
    mockValues,
    mockOnConflictDoUpdate,
  };
});

vi.mock("../../../server/utils/auth", () => ({
  ensureUser: mockEnsureUser,
}));
vi.mock("../../../server/utils/clerkAccount", () => ({
  clerkUpdateName: mockClerkUpdateName,
}));
vi.mock("../../../server/db/index", () => ({ getDb: mockGetDb }));

stubDefineEventHandler();
stubCreateError();
Object.assign(globalThis, { readBody: mockReadBody });

const { default: handler } =
  await import("../../../server/api/account/name.patch");

describe("PATCH /api/account/name", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureUser.mockResolvedValue("user-1");
    mockClerkUpdateName.mockResolvedValue(undefined);
    mockOnConflictDoUpdate.mockResolvedValue(undefined);
    mockReadBody.mockResolvedValue({ firstName: "Dan", lastName: "Holloran" });
  });

  it("saves first and last name to Clerk", async () => {
    await callHandler(handler, buildAccountEvent());

    expect(mockClerkUpdateName).toHaveBeenCalledWith("user-1", {
      firstName: "Dan",
      lastName: "Holloran",
    });
  });

  it("syncs the stored display name so profiles, guides and search agree with Clerk", async () => {
    const result = await callHandler(handler, buildAccountEvent());

    expect(mockValues).toHaveBeenCalledWith({
      userId: "user-1",
      displayName: "Dan Holloran",
    });
    expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ set: { displayName: "Dan Holloran" } }),
    );
    expect(result).toEqual({
      firstName: "Dan",
      lastName: "Holloran",
      displayName: "Dan Holloran",
    });
  });

  it("handles a user with no last name: clears it in Clerk and stores just the first name", async () => {
    mockReadBody.mockResolvedValue({ firstName: "Cher", lastName: "" });

    const result = await callHandler(handler, buildAccountEvent());

    expect(mockClerkUpdateName).toHaveBeenCalledWith("user-1", {
      firstName: "Cher",
      lastName: null,
    });
    expect(mockValues).toHaveBeenCalledWith({
      userId: "user-1",
      displayName: "Cher",
    });
    expect(result).toMatchObject({ displayName: "Cher" });
  });

  it("treats a missing lastName the same as an empty one", async () => {
    mockReadBody.mockResolvedValue({ firstName: "Cher" });

    await callHandler(handler, buildAccountEvent());

    expect(mockClerkUpdateName).toHaveBeenCalledWith("user-1", {
      firstName: "Cher",
      lastName: null,
    });
  });

  it("trims whitespace from both parts", async () => {
    mockReadBody.mockResolvedValue({
      firstName: "  Dan ",
      lastName: " Holloran  ",
    });

    const result = await callHandler(handler, buildAccountEvent());

    expect(result).toMatchObject({ displayName: "Dan Holloran" });
  });

  it.each([{}, { firstName: "" }, { firstName: "   " }, { firstName: 42 }])(
    "rejects a missing or blank first name %j with 400 and writes nothing",
    async (body) => {
      mockReadBody.mockResolvedValue(body);

      await expect(
        callHandler(handler, buildAccountEvent()),
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(mockClerkUpdateName).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    },
  );

  it("rejects a non-string last name with 400", async () => {
    mockReadBody.mockResolvedValue({ firstName: "Dan", lastName: 7 });

    await expect(
      callHandler(handler, buildAccountEvent()),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects an over-long name part with 400", async () => {
    mockReadBody.mockResolvedValue({ firstName: "x".repeat(51) });

    await expect(
      callHandler(handler, buildAccountEvent()),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mockClerkUpdateName).not.toHaveBeenCalled();
  });

  it("rejects a non-object body with 400", async () => {
    mockReadBody.mockResolvedValue(["Dan"]);

    await expect(
      callHandler(handler, buildAccountEvent()),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("surfaces a Clerk failure as 502 and does not touch the database", async () => {
    mockClerkUpdateName.mockRejectedValue({
      errors: [{ longMessage: "Name is too long." }],
    });

    await expect(
      callHandler(handler, buildAccountEvent()),
    ).rejects.toMatchObject({
      statusCode: 502,
      statusMessage: "Name is too long.",
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("reports a failed display-name sync instead of claiming success", async () => {
    mockOnConflictDoUpdate.mockRejectedValue(new Error("db down"));

    await expect(
      callHandler(handler, buildAccountEvent()),
    ).rejects.toMatchObject({ statusCode: 500 });
  });

  it("propagates the auth failure", async () => {
    mockEnsureUser.mockRejectedValue(
      Object.assign(new Error("Unauthorized"), { statusCode: 401 }),
    );

    await expect(
      callHandler(handler, buildAccountEvent()),
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(mockClerkUpdateName).not.toHaveBeenCalled();
  });
});
