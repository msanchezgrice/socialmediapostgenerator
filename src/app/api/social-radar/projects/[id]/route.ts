import { z } from "zod";
import { getAuthUserSeed } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { ensureProfile, updateProject } from "@/lib/radar-store";

const schema = z.object({
  name: z.string().min(1).optional(),
  domain: z.string().nullable().optional(),
  repoName: z.string().nullable().optional(),
  productType: z.string().nullable().optional(),
  inventoryStatus: z.string().nullable().optional(),
  contactEmail: z.string().email().nullable().optional().or(z.literal("")),
  notes: z.string().nullable().optional(),
  scanQuery: z.string().nullable().optional(),
  active: z.boolean().optional(),
  autoScan: z.boolean().optional(),
  platformHandles: z.record(z.string(), z.string()).optional(),
});

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const seed = await getAuthUserSeed();
  if (!seed) {
    return jsonError("UNAUTHENTICATED", "Sign in required", 401);
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return jsonError("INVALID_BODY", "Invalid project update payload", 400, { issues: parsed.error.issues });
  }

  try {
    const profile = await ensureProfile(seed);
    const { id } = await context.params;
    await updateProject(profile.id, id, parsed.data);
    return jsonOk({ updated: true });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "UNKNOWN";
    const status = reason === "PROJECT_NOT_FOUND" ? 404 : 500;
    return jsonError("UPDATE_FAILED", "Unable to update project", status, { reason });
  }
}
