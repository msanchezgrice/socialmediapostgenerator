import { timingSafeEqual } from "node:crypto";

function equalSecret(provided, expected) {
  if (!provided || !expected) return false;
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}

/**
 * Vercel Cron uses Authorization: Bearer $CRON_SECRET. The previous custom
 * header remains accepted for existing internal callers. URL query secrets
 * are deliberately ignored because URLs are routinely copied into logs.
 */
export function authorizeSocialRadarCron(request, env = process.env) {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const bearer = /^Bearer\s+(.+)$/i.exec(authorization)?.[1]?.trim() ?? "";
  if (equalSecret(bearer, env.CRON_SECRET?.trim())) return true;

  const legacyHeader = request.headers.get("x-cron-secret")?.trim() ?? "";
  return equalSecret(legacyHeader, env.SOCIAL_RADAR_CRON_SECRET?.trim());
}
