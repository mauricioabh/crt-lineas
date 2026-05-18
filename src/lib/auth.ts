import { auth, currentUser } from "@clerk/nextjs/server";

export type AppRole = "admin" | "user";

export function getRoleFromPublicMetadata(
  metadata: Record<string, unknown> | undefined,
): AppRole {
  const raw = metadata?.role;
  if (raw === "admin") {
    return "admin";
  }
  return "user";
}

export async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("UNAUTHORIZED");
  }
  return userId;
}

export async function requireAdminUser() {
  const user = await currentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  const role = getRoleFromPublicMetadata(
    user.publicMetadata as Record<string, unknown> | undefined,
  );
  if (role !== "admin") {
    throw new Error("FORBIDDEN");
  }
  return user;
}

export async function getCurrentRole(): Promise<AppRole> {
  const user = await currentUser();
  if (!user) {
    return "user";
  }
  return getRoleFromPublicMetadata(
    user.publicMetadata as Record<string, unknown> | undefined,
  );
}
