/**
 * Isolated Clerk backend account-management operations.
 *
 * These thin wrappers keep the Clerk SDK behind a single seam so API handlers
 * can be unit-tested by mocking this module rather than the SDK directly.
 */
import { getClerkClient } from "./clerk";

export async function clerkUpdatePassword(
  userId: string,
  password: string,
): Promise<void> {
  const clerkClient = getClerkClient();
  await clerkClient.users.updateUser(userId, { password });
}

export async function clerkSetProfileImage(
  userId: string,
  fileBlob: Blob,
): Promise<string | null> {
  const clerkClient = getClerkClient();
  const user = await clerkClient.users.updateUserProfileImage(userId, {
    file: fileBlob,
  });
  return user.imageUrl ?? null;
}

export async function clerkRemoveProfileImage(userId: string): Promise<void> {
  const clerkClient = getClerkClient();
  await clerkClient.users.deleteUserProfileImage(userId);
}

export async function clerkDeleteUser(userId: string): Promise<void> {
  const clerkClient = getClerkClient();
  await clerkClient.users.deleteUser(userId);
}

export async function clerkUpdateName(
  userId: string,
  name: { firstName: string; lastName: string | null },
): Promise<void> {
  const clerkClient = getClerkClient();
  // A null lastName is sent as-is; Clerk's params type only allows a string.
  await clerkClient.users.updateUser(
    userId,
    name as Parameters<typeof clerkClient.users.updateUser>[1],
  );
}
