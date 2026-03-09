import { auth, clerkClient } from "@clerk/nextjs/server";

export type AuthUserSeed = {
  clerkUserId: string;
  email: string | null;
  name: string;
};

export async function getAuthUserSeed(): Promise<AuthUserSeed | null> {
  const session = await auth();
  if (!session.userId) return null;

  const claims = (session.sessionClaims ?? null) as Record<string, unknown> | null;
  const user = await clerkClient()
    .then((client) => client.users.getUser(session.userId))
    .catch(() => null);

  const email =
    user?.emailAddresses?.find((entry) => entry.id === user.primaryEmailAddressId)?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    (typeof claims?.email === "string" ? claims.email : null);
  const name =
    user?.fullName?.trim() ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    (typeof claims?.fullName === "string" ? claims.fullName.trim() : "") ||
    (typeof claims?.name === "string" ? claims.name.trim() : "") ||
    email?.split("@")[0] ||
    "Operator";

  return {
    clerkUserId: session.userId,
    email,
    name,
  };
}
