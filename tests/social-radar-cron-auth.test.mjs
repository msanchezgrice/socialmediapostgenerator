import test from "node:test";
import assert from "node:assert/strict";
import { authorizeSocialRadarCron } from "../src/lib/social-radar-cron-auth.mjs";

const request = (headers = {}, url = "https://example.test/api/cron/social-radar") =>
  new Request(url, { headers });

test("denies missing authentication and query-string credentials", () => {
  assert.equal(authorizeSocialRadarCron(request(), {}), false);
  assert.equal(
    authorizeSocialRadarCron(request({}, "https://example.test/api/cron/social-radar?secret=legacy"), {
      SOCIAL_RADAR_CRON_SECRET: "legacy",
    }),
    false,
  );
});

test("accepts Vercel's Bearer cron contract using CRON_SECRET", () => {
  assert.equal(
    authorizeSocialRadarCron(request({ authorization: "Bearer vercel-secret" }), { CRON_SECRET: "vercel-secret" }),
    true,
  );
});

test("accepts the existing internal header only with SOCIAL_RADAR_CRON_SECRET", () => {
  assert.equal(
    authorizeSocialRadarCron(request({ "x-cron-secret": "internal-secret" }), {
      SOCIAL_RADAR_CRON_SECRET: "internal-secret",
    }),
    true,
  );
});

test("does not cross-accept the Vercel secret in the legacy header", () => {
  assert.equal(
    authorizeSocialRadarCron(request({ "x-cron-secret": "vercel-secret" }), { CRON_SECRET: "vercel-secret" }),
    false,
  );
});

test("rejects malformed and mismatched authorization headers", () => {
  assert.equal(
    authorizeSocialRadarCron(request({ authorization: "Basic vercel-secret" }), { CRON_SECRET: "vercel-secret" }),
    false,
  );
  assert.equal(
    authorizeSocialRadarCron(request({ authorization: "Bearer wrong" }), { CRON_SECRET: "vercel-secret" }),
    false,
  );
});
