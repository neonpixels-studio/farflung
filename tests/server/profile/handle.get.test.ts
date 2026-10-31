import { describe, it, expect, vi, beforeEach } from "vitest";
import { installNitroGlobals, unwrapHandler } from "../follows/_helpers";

installNitroGlobals();

vi.mock("../../../server/utils/auth", () => ({
  optionalUser: vi.fn(),
  requireUser: vi.fn(),
}));

vi.mock("../../../server/db/index", () => ({
  getDb: vi.fn(() => ({})),
}));

vi.mock("../../../server/utils/handle-queries", () => ({
  findUserIdByHandle: vi.fn(),
  isHandleTaken: vi.fn(),
}));

vi.mock("../../../server/utils/profile-queries", () => ({
  requireViewableProfile: vi.fn(),
}));

import { optionalUser, requireUser } from "../../../server/utils/auth";
import {
  findUserIdByHandle,
  isHandleTaken,
} from "../../../server/utils/handle-queries";
import { requireViewableProfile } from "../../../server/utils/profile-queries";

const mockOptionalUser = vi.mocked(optionalUser);
const mockRequireUser = vi.mocked(requireUser);
const mockFindUserIdByHandle = vi.mocked(findUserIdByHandle);
const mockIsHandleTaken = vi.mocked(isHandleTaken);
const mockRequireViewableProfile = vi.mocked(requireViewableProfile);

const resolveHandler = unwrapHandler(
  (await import("../../../server/api/handles/[handle].get")) as Record<
    string,
    unknown
  >,
);
const availabilityHandler = unwrapHandler(
  (await import("../../../server/api/handles/[handle]/availability.get")) as Record<
    string,
    unknown
  >,
);

function profileRow(overrides: Record<string, unknown> = {}) {
  return {
    userId: "target-1",
    displayName: "Elsa",
    handle: "Elsa_Far",
    homeBase: null,
    bio: null,
    publicProfile: true,
    effectivelyPublic: true,
    followerCount: 0,
    followingCount: 0,
    placeCount: 0,
    ...overrides,
  };
}

describe("GET /api/handles/[handle]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getRouterParam as ReturnType<typeof vi.fn>).mockReturnValue("elsa_far");
  });

  it("resolves the handle to the viewable profile for an anonymous visitor", async () => {
    mockOptionalUser.mockReturnValue(null);
    mockFindUserIdByHandle.mockResolvedValue("target-1");
    mockRequireViewableProfile.mockResolvedValue(profileRow());

    const result = await resolveHandler({});

    expect(result).toMatchObject({ userId: "target-1", isSelf: false });
    expect(mockFindUserIdByHandle).toHaveBeenCalledWith({}, "elsa_far");
    expect(mockRequireViewableProfile).toHaveBeenCalledWith(
      {},
      null,
      "target-1",
    );
  });

  it("marks the profile as self when the owner views their own handle", async () => {
    mockOptionalUser.mockReturnValue("target-1");
    mockFindUserIdByHandle.mockResolvedValue("target-1");
    mockRequireViewableProfile.mockResolvedValue(
      profileRow({ publicProfile: false, effectivelyPublic: false }),
    );

    expect(await resolveHandler({})).toMatchObject({ isSelf: true });
  });

  it("returns 404 for an unknown handle without touching the profile guard", async () => {
    mockOptionalUser.mockReturnValue(null);
    mockFindUserIdByHandle.mockResolvedValue(null);

    await expect(resolveHandler({})).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: "Profile not found",
    });
    expect(mockRequireViewableProfile).not.toHaveBeenCalled();
  });

  it("does not expose a private profile: the visibility guard's 404 propagates, identical to an unknown handle", async () => {
    mockOptionalUser.mockReturnValue("someone-else");
    mockFindUserIdByHandle.mockResolvedValue("target-1");
    mockRequireViewableProfile.mockRejectedValue(
      createError({ statusCode: 404, statusMessage: "Profile not found" }),
    );

    await expect(resolveHandler({})).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: "Profile not found",
    });
  });

  it("returns 400 when the handle param is missing", async () => {
    (getRouterParam as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    mockOptionalUser.mockReturnValue(null);

    await expect(resolveHandler({})).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe("GET /api/handles/[handle]/availability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockReturnValue("me-1");
  });

  it("requires a session", async () => {
    mockRequireUser.mockImplementation(() => {
      throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
    });
    (getRouterParam as ReturnType<typeof vi.fn>).mockReturnValue("elsa_far");

    await expect(availabilityHandler({})).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("reports a free, well-formed handle as available", async () => {
    (getRouterParam as ReturnType<typeof vi.fn>).mockReturnValue("elsa_far");
    mockIsHandleTaken.mockResolvedValue(false);

    expect(await availabilityHandler({})).toEqual({
      available: true,
      reason: null,
      message: null,
    });
    expect(mockIsHandleTaken).toHaveBeenCalledWith({}, "elsa_far", "me-1");
  });

  it("reports a handle held by someone else as taken", async () => {
    (getRouterParam as ReturnType<typeof vi.fn>).mockReturnValue("Elsa_Far");
    mockIsHandleTaken.mockResolvedValue(true);

    expect(await availabilityHandler({})).toMatchObject({
      available: false,
      reason: "taken",
    });
  });

  it("reports a format problem without querying the database", async () => {
    (getRouterParam as ReturnType<typeof vi.fn>).mockReturnValue("no spaces");

    expect(await availabilityHandler({})).toMatchObject({
      available: false,
      reason: "invalid_characters",
    });
    expect(mockIsHandleTaken).not.toHaveBeenCalled();
  });

  it("reports a reserved handle without querying the database", async () => {
    (getRouterParam as ReturnType<typeof vi.fn>).mockReturnValue("settings");

    expect(await availabilityHandler({})).toMatchObject({
      available: false,
      reason: "reserved",
    });
    expect(mockIsHandleTaken).not.toHaveBeenCalled();
  });
});
