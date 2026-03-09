import { auth, currentUser } from "@clerk/nextjs/server";

export type AuthUserSeed = {
  clerkUserId: string;
  email: string | null;
  name: string;
};

export async function getAuthUserSeed(): Promise<AuthUserSeed | null> {
  const session = await auth();
  if (!session.userId) return null;

  const user = await currentUser().catch(() => null);
  const email = user?.emailAddresses?.find((entry) => entry.id === user.primaryEmailAddressId)?.emailAddress ?? null;
  const name =
    user?.fullName?.trim() ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    email?.split("@")[0] ||
    "Operator";

  return {
    clerkUserId: session.userId,
    email,
    name,
  };
}
