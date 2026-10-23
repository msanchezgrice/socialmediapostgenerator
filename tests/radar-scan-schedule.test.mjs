import test from "node:test";
import assert from "node:assert/strict";
import {
  cachedProjectsForDailyDigest,
  calendarDateInTimeZone,
  isDailyRadarScanDue,
} from "../src/lib/radar-scan-schedule.mjs";

test("evening manual scan and next-morning cron share the UTC reservation day", () => {
  // 20:00 America/New_York on Oct 22 is 00:00 UTC on Oct 23.
  const manualScan = new Date("2026-10-23T00:00:00.000Z");
  const nextMorningCron = new Date("2026-10-23T13:00:00.000Z");

  assert.equal(calendarDateInTimeZone(manualScan, "America/New_York"), "2026-10-22");
  assert.equal(calendarDateInTimeZone(nextMorningCron, "America/New_York"), "2026-10-23");
  assert.equal(calendarDateInTimeZone(manualScan, "UTC"), "2026-10-23");
  assert.equal(isDailyRadarScanDue(manualScan.toISOString(), nextMorningCron), false);
  const [digestProject] = cachedProjectsForDailyDigest([{
    id: "project-1",
    profile_id: "profile-1",
    name: "Example",
    domain: "example.com",
    last_scanned_at: manualScan.toISOString(),
    analysis_summary: "Manual scan results remain available for the daily digest.",
  }], nextMorningCron);
  assert.equal(digestProject.analysisSummary,
    "Manual scan results remain available for the daily digest.");
  assert.equal(digestProject.topSignalTitle, null);
});

test("the same project becomes due again after the UTC reservation day rolls over", () => {
  const manualScan = "2026-10-23T00:00:00.000Z";
  const nextUtcDay = new Date("2026-10-24T13:00:00.000Z");
  assert.equal(isDailyRadarScanDue(manualScan, nextUtcDay), true);
});

test("projects without a prior scan remain due", () => {
  assert.equal(isDailyRadarScanDue(null, new Date("2026-10-23T13:00:00.000Z")), true);
});

test("cached digest includes only same-UTC-day scans with a saved summary", () => {
  const now = new Date("2026-10-23T13:00:00.000Z");
  const projects = [
    { id: "current", profile_id: "p1", name: "Current", last_scanned_at: "2026-10-23T01:00:00Z", analysis_summary: "current summary" },
    { id: "old", profile_id: "p1", name: "Old", last_scanned_at: "2026-10-22T23:59:59Z", analysis_summary: "old summary" },
    { id: "empty", profile_id: "p1", name: "Empty", last_scanned_at: "2026-10-23T02:00:00Z", analysis_summary: "" },
  ];
  assert.deepEqual(cachedProjectsForDailyDigest(projects, now).map((project) => project.projectId), ["current"]);
});
