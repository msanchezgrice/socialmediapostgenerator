import { getAuthUserSeed } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { ensureProfile, importRebootInventory } from "@/lib/radar-store";

export async function POST() {
  const seed = await getAuthUserSeed();
  if (!seed) {
    return jsonError("UNAUTHENTICATED", "Sign in required", 401);
  }

  try {
    const profile = await ensureProfile(seed);
    const result = await importRebootInventory(profile.id);
    return jsonOk(result);
  } catch (error) {
    return jsonError("IMPORT_FAILED", "Unable to import Reboot inventory", 500, {
      reason: error instanceof Error ? error.message : "UNKNOWN",
    });
  }
}
