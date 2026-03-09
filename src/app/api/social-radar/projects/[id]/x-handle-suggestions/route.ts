import { getAuthUserSeed } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { ensureProfile, getProjectXHandleSuggestions } from "@/lib/radar-store";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const seed = await getAuthUserSeed();
  if (!seed) {
    return jsonError("UNAUTHENTICATED", "Sign in required", 401);
  }

  try {
    const profile = await ensureProfile(seed);
    const { id } = await context.params;
    const result = await getProjectXHandleSuggestions(profile.id, id);
    return jsonOk(result);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "UNKNOWN";
    const status = reason === "PROJECT_NOT_FOUND" ? 404 : 500;
    return jsonError("HANDLE_SUGGESTIONS_FAILED", "Unable to load X handle suggestions", status, { reason });
  }
}
