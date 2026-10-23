import test from "node:test";
import assert from "node:assert/strict";
import { runReservedRadarScan } from "../src/lib/radar-scan-admission.mjs";
import { isOwnedRadarProject } from "../src/lib/radar-access.mjs";

test("owner project access rejects anonymous, foreign, and mismatched records", () => {
  const ownedProject = { id: "project-1", profile_id: "profile-1" };
  assert.equal(isOwnedRadarProject(ownedProject, "profile-1", "project-1"), true);
  assert.equal(isOwnedRadarProject(ownedProject, "profile-2", "project-1"), false);
  assert.equal(isOwnedRadarProject(ownedProject, "profile-1", "project-2"), false);
  assert.equal(isOwnedRadarProject(ownedProject, null, "project-1"), false);
});

test("denied admission fails closed before work", async () => {
  let executed = false;
  const result = await runReservedRadarScan({
    reserve: async () => ({ status: "daily_limit" }),
    execute: async () => { executed = true; },
    settle: async () => assert.fail("must not settle a rejected reservation"),
  });
  assert.deepEqual(result, { admitted: false, status: "daily_limit" });
  assert.equal(executed, false);
});

test("stable duplicate reservation skips repeat work across owner and cron callers", async () => {
  let executed = false;
  const result = await runReservedRadarScan({
    reserve: async () => ({ status: "duplicate" }),
    execute: async () => { executed = true; },
    settle: async () => assert.fail("duplicate reservations must not settle again"),
  });
  assert.deepEqual(result, { admitted: false, status: "duplicate" });
  assert.equal(executed, false);
});

test("successful work settles the durable reservation", async () => {
  const settlements = [];
  const result = await runReservedRadarScan({
    reserve: async () => ({ status: "reserved", reservationId: "reservation-1" }),
    execute: async () => "research-result",
    settle: async (...args) => settlements.push(args),
  });
  assert.deepEqual(result, { admitted: true, value: "research-result" });
  assert.deepEqual(settlements, [["reservation-1", "completed"]]);
});

test("provider failure is conservatively settled as charged failure", async () => {
  const settlements = [];
  await assert.rejects(
    runReservedRadarScan({
      reserve: async () => ({ status: "reserved", reservationId: "reservation-2" }),
      execute: async () => { throw new Error("provider request failed"); },
      settle: async (...args) => settlements.push(args),
    }),
    /provider request failed/,
  );
  assert.deepEqual(settlements, [["reservation-2", "failed"]]);
});

test("settlement outage leaves the reservation consumed and surfaces work failure", async () => {
  await assert.rejects(
    runReservedRadarScan({
      reserve: async () => ({ status: "reserved", reservationId: "reservation-3" }),
      execute: async () => { throw new Error("ambiguous timeout"); },
      settle: async () => { throw new Error("database unavailable"); },
    }),
    /ambiguous timeout/,
  );
});
