import { describe, it, expect, vi, beforeEach } from "vitest";
import { stubNitroGlobals } from "../test-utils";

stubNitroGlobals();

const mockReadBody = vi.fn();
vi.stubGlobal("readBody", mockReadBody);

vi.mock("../../../server/utils/auth", () => ({
  requireUser: vi.fn(),
  ensureUser: vi.fn(),
}));

vi.mock("../../../server/db/index", () => ({
  getDb: vi.fn(),
}));

import { ensureUser } from "../../../server/utils/auth";
import { getDb } from "../../../server/db/index";

const mockEnsureUser = vi.mocked(ensureUser);
const mockGetDb = vi.mocked(getDb);

function makeDbWithInsert(returned: Record<string, unknown>) {
  const returningMock = vi.fn().mockResolvedValue([returned]);
  const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
  const insertMock = vi.fn().mockReturnValue({ values: valuesMock });
  return { insert: insertMock, _values: valuesMock };
}

const handler = await import("../../../server/api/guides/index.post");

describe("POST /api/guides", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a guide with minimal required fields", async () => {
    const createdGuide = {
      id: "uuid-1",
      userId: "user-1",
      title: "Tokyo on foot",
      body: null,
      readTimeMinutes: 5,
      likeCount: 0,
      visibility: "private",
    };
    mockEnsureUser.mockResolvedValue("user-1");
    mockReadBody.mockResolvedValue({ title: "Tokyo on foot" });
    const mockDb = makeDbWithInsert(createdGuide);
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const result = await (
      handler.default as (event: unknown) => Promise<unknown>
    )({});

    expect(result).toEqual(createdGuide);
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    expect(mockDb._values).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Tokyo on foot",
        userId: "user-1",
        visibility: "private",
      }),
    );
    // likeCount must never be settable through the authoring path — the
    // insert payload must not include it so the column default (0) applies.
    expect(mockDb._values.mock.calls[0]![0]).not.toHaveProperty("likeCount");
  });

  it("accepts body, readTimeMinutes, and visibility", async () => {
    const createdGuide = {
      id: "uuid-2",
      userId: "user-1",
      title: "Slow coastlines",
      body: "Start at the north jetty…",
      readTimeMinutes: 8,
      likeCount: 0,
      visibility: "public",
    };
    mockEnsureUser.mockResolvedValue("user-1");
    mockReadBody.mockResolvedValue({
      title: "Slow coastlines",
      body: "Start at the north jetty…",
      readTimeMinutes: 8,
      visibility: "public",
    });
    const mockDb = makeDbWithInsert(createdGuide);
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    const result = await (
      handler.default as (event: unknown) => Promise<unknown>
    )({});

    expect(result).toEqual(createdGuide);
    expect(mockDb._values).toHaveBeenCalledWith(
      expect.objectContaining({
        readTimeMinutes: 8,
        visibility: "public",
      }),
    );
  });

  it("trims the title", async () => {
    mockEnsureUser.mockResolvedValue("user-1");
    mockReadBody.mockResolvedValue({ title: "  Tokyo on foot  " });
    const mockDb = makeDbWithInsert({ id: "uuid-3" });
    mockGetDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDb>);

    await (handler.default as (event: unknown) => Promise<unknown>)({});

    expect(mockDb._values).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Tokyo on foot" }),
    );
  });

  it("throws 400 when title is missing", async () => {
    mockEnsureUser.mockResolvedValue("user-1");
    mockReadBody.mockResolvedValue({});

    await expect(
      (handler.default as (event: unknown) => Promise<unknown>)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when title is an empty string", async () => {
    mockEnsureUser.mockResolvedValue("user-1");
    mockReadBody.mockResolvedValue({ title: "   " });

    await expect(
      (handler.default as (event: unknown) => Promise<unknown>)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 for an invalid visibility value", async () => {
    mockEnsureUser.mockResolvedValue("user-1");
    mockReadBody.mockResolvedValue({
      title: "Tokyo on foot",
      visibility: "friends-only",
    });

    await expect(
      (handler.default as (event: unknown) => Promise<unknown>)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when readTimeMinutes is less than 1", async () => {
    mockEnsureUser.mockResolvedValue("user-1");
    mockReadBody.mockResolvedValue({
      title: "Tokyo on foot",
      readTimeMinutes: 0,
    });

    await expect(
      (handler.default as (event: unknown) => Promise<unknown>)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when readTimeMinutes is not an integer", async () => {
    mockEnsureUser.mockResolvedValue("user-1");
    mockReadBody.mockResolvedValue({
      title: "Tokyo on foot",
      readTimeMinutes: 3.5,
    });

    await expect(
      (handler.default as (event: unknown) => Promise<unknown>)({}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 401 when not authenticated", async () => {
    const unauthorizedError = createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
    mockEnsureUser.mockRejectedValue(unauthorizedError);
    mockReadBody.mockResolvedValue({ title: "Tokyo on foot" });

    await expect(
      (handler.default as (event: unknown) => Promise<unknown>)({}),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});
