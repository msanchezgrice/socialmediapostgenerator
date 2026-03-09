import { getAuthUserSeed } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { ensureProfile, refreshDueProjects } from "@/lib/radar-store";

export const maxDuration = 800;

export async function POST() {
  const seed = await getAuthUserSeed();
  if (!seed) {
    return jsonError("UNAUTHENTICATED", "Sign in required", 401);
  }

  try {
    const profile = await ensureProfile(seed);
    const result = await refreshDueProjects({
      profileId: profile.id,
      limit: 8,
    });
    return jsonOk(result);
  } catch (error) {
    return jsonError("BATCH_FAILED", "Unable to run project batch", 500, {
      reason: error instanceof Error ? error.message : "UNKNOWN",
    });
  }
}
