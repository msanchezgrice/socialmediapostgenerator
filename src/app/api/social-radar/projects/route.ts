import { z } from "zod";
import { getAuthUserSeed } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { createManualProjects, ensureProfile } from "@/lib/radar-store";

const entrySchema = z.object({
  name: z.string().min(1),
  domain: z.string().nullable().optional(),
  repoName: z.string().nullable().optional(),
  productType: z.string().nullable().optional(),
  inventoryStatus: z.string().nullable().optional(),
  contactEmail: z.string().email().nullable().optional().or(z.literal("")),
  notes: z.string().nullable().optional(),
  scanQuery: z.string().nullable().optional(),
  active: z.boolean().optional(),
  autoScan: z.boolean().optional(),
});

const schema = z.object({
  entries: z.array(entrySchema).min(1).max(25),
});

export async function POST(req: Request) {
  const seed = await getAuthUserSeed();
  if (!seed) {
    return jsonError("UNAUTHENTICATED", "Sign in required", 401);
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return jsonError("INVALID_BODY", "Invalid project payload", 400, { issues: parsed.error.issues });
  }

  try {
    const profile = await ensureProfile(seed);
    const result = await createManualProjects(profile.id, parsed.data.entries);
    return jsonOk(result);
  } catch (error) {
    return jsonError("CREATE_FAILED", "Unable to add projects", 500, {
      reason: error instanceof Error ? error.message : "UNKNOWN",
    });
  }
}
