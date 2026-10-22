import { jsonError, jsonOk } from "@/lib/http";
import { sendRadarDigestEmails } from "@/lib/radar-digest";
import { refreshDueProjects } from "@/lib/radar-store";
import { authorizeSocialRadarCron } from "@/lib/social-radar-cron-auth.mjs";

export const maxDuration = 800;

export async function GET(req: Request) {
  if (!authorizeSocialRadarCron(req)) {
    return jsonError("FORBIDDEN", "Invalid cron secret", 403);
  }

  try {
    const result = await refreshDueProjects({ limit: 250 });
    const digest = await sendRadarDigestEmails(result.refreshedProjects);
    return jsonOk({ ...result, digest });
  } catch (error) {
    return jsonError("CRON_FAILED", "Unable to run Social Radar cron", 500, {
      reason: error instanceof Error ? error.message : "UNKNOWN",
    });
  }
}
