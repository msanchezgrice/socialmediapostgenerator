import { getAuthUserSeed } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { ensureProfile, getRadarSummary } from "@/lib/radar-store";

export async function GET() {
  const seed = await getAuthUserSeed();
  if (!seed) {
    return jsonError("UNAUTHENTICATED", "Sign in required", 401);
  }

  try {
    const profile = await ensureProfile(seed);
    const summary = await getRadarSummary(profile.id);
    return jsonOk({ summary });
  } catch (error) {
    return jsonError("SUMMARY_LOAD_FAILED", "Unable to load dashboard summary", 500, {
      reason: error instanceof Error ? error.message : "UNKNOWN",
    });
  }
}
