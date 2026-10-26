import { vi, expect } from "vitest";
import type {
  loadOwnedOrThrow,
  assertOwnership,
} from "../../../server/utils/db-helpers";

/**
 * Returns a db mock that handles the update -> set -> where -> returning chain,
 * used by like.post and like.delete handlers.
 */
export function makeDbForUpdate(updatedEntry: Record<string, unknown>) {
  const returningMock = vi.fn().mockResolvedValue([updatedEntry]);
  const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
  const setMock = vi.fn().mockReturnValue({ where: whereMock });
  const updateMock = vi.fn().mockReturnValue({ set: setMock });
  return { update: updateMock };
}

/**
 * Returns a db mock for the delete handler (delete -> where chain).
 */
export function makeDbForDelete() {
  const whereMock = vi.fn().mockResolvedValue(undefined);
  const deleteMock = vi.fn().mockReturnValue({ where: whereMock });
  return { delete: deleteMock };
}

/**
 * Asserts that a handler throws 404 when assertOwnership rejects with 404.
 */
export async function assertThrows404ViaOwnership(
  mockRequireRouterParam: ReturnType<typeof vi.fn>,
  mockAssertOwnership: ReturnType<typeof vi.mocked<typeof assertOwnership>>,
  handler:
    { default?: (event: unknown) => unknown } | ((event: unknown) => unknown),
) {
  mockRequireRouterParam.mockReturnValue("e-1");
  const notFoundError = createError({
    statusCode: 404,
    statusMessage: "Not found",
  });
  mockAssertOwnership.mockRejectedValue(notFoundError);

  const invoke = ("default" in handler ? handler.default : handler) as (
    event: unknown,
  ) => unknown;

  await expect(invoke({})).rejects.toMatchObject({ statusCode: 404 });
}

/**
 * Asserts that a handler throws 401 when assertOwnership rejects with 401.
 */
export async function assertThrows401ViaOwnership(
  mockRequireRouterParam: ReturnType<typeof vi.fn>,
  mockAssertOwnership: ReturnType<typeof vi.mocked<typeof assertOwnership>>,
  handler:
    { default?: (event: unknown) => unknown } | ((event: unknown) => unknown),
) {
  mockRequireRouterParam.mockReturnValue("e-1");
  const unauthorizedError = createError({
    statusCode: 401,
    statusMessage: "Unauthorized",
  });
  mockAssertOwnership.mockRejectedValue(unauthorizedError);

  const invoke = ("default" in handler ? handler.default : handler) as (
    event: unknown,
  ) => unknown;

  await expect(invoke({})).rejects.toMatchObject({ statusCode: 401 });
}

/**
 * Returns a db mock for the entry GET handler (two select chains: photos + tags).
 */
export function makeDbForEntryGet() {
  const photosWhereMock = vi.fn().mockResolvedValue([]);
  const photosFromMock = vi.fn().mockReturnValue({ where: photosWhereMock });

  const tagsWhereMock = vi.fn().mockResolvedValue([]);
  const tagsInnerJoinMock = vi.fn().mockReturnValue({ where: tagsWhereMock });
  const tagsFromMock = vi
    .fn()
    .mockReturnValue({ innerJoin: tagsInnerJoinMock });

  let callCount = 0;

  return {
    select: vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { from: photosFromMock };
      }
      return { from: tagsFromMock };
    }),
  };
}

/**
 * Asserts that a handler throws 404 when loadOwnedOrThrow rejects with 404.
 * Requires `mockRequireRouterParam` to already be set up to return a valid id.
 */
export async function assertThrows404WhenNotOwned(
  mockRequireRouterParam: ReturnType<typeof vi.fn>,
  mockLoadOwnedOrThrow: ReturnType<typeof vi.mocked<typeof loadOwnedOrThrow>>,
  handler:
    { default?: (event: unknown) => unknown } | ((event: unknown) => unknown),
) {
  mockRequireRouterParam.mockReturnValue("e-1");
  const notFoundError = createError({
    statusCode: 404,
    statusMessage: "Not found",
  });
  mockLoadOwnedOrThrow.mockRejectedValue(notFoundError);

  const invoke = ("default" in handler ? handler.default : handler) as (
    event: unknown,
  ) => unknown;

  await expect(invoke({})).rejects.toMatchObject({ statusCode: 404 });
}

/**
 * Asserts that a handler throws 401 when loadOwnedOrThrow rejects with 401.
 * Requires `mockRequireRouterParam` to already be set up to return a valid id.
 */
export async function assertThrows401WhenUnauthenticated(
  mockRequireRouterParam: ReturnType<typeof vi.fn>,
  mockLoadOwnedOrThrow: ReturnType<typeof vi.mocked<typeof loadOwnedOrThrow>>,
  handler:
    { default?: (event: unknown) => unknown } | ((event: unknown) => unknown),
) {
  mockRequireRouterParam.mockReturnValue("e-1");
  const unauthorizedError = createError({
    statusCode: 401,
    statusMessage: "Unauthorized",
  });
  mockLoadOwnedOrThrow.mockRejectedValue(unauthorizedError);

  const invoke = ("default" in handler ? handler.default : handler) as (
    event: unknown,
  ) => unknown;

  await expect(invoke({})).rejects.toMatchObject({ statusCode: 401 });
}
