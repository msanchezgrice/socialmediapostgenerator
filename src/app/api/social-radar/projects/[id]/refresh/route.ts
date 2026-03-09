import { getAuthUserSeed } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { ensureProfile, refreshProject } from "@/lib/radar-store";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const seed = await getAuthUserSeed();
  if (!seed) {
    return jsonError("UNAUTHENTICATED", "Sign in required", 401);
  }

  try {
    const profile = await ensureProfile(seed);
    const { id } = await context.params;
    const research = await refreshProject(profile.id, id);
    return jsonOk({ research });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "UNKNOWN";
    const status = reason === "PROJECT_NOT_FOUND" ? 404 : 500;
    return jsonError("REFRESH_FAILED", "Unable to refresh project", status, { reason });
  }
}
