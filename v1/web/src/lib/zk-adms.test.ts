import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeBiometricUserId,
  normalizeDeviceSn,
  parseAttlog,
  resolveZkKind,
  wallTimeToIso,
  zkHandshake,
  zkStatusToIntent,
  zkTimeZoneValue,
} from "./zk-adms";

test("normalizes clock serials and user ids", () => {
  assert.equal(normalizeDeviceSn(" af4c183760123 "), "AF4C183760123");
  assert.equal(normalizeDeviceSn("AB"), null);
  assert.equal(normalizeDeviceSn("DROP TABLE"), null);
  assert.equal(normalizeBiometricUserId(" 15 "), "15");
  assert.equal(normalizeBiometricUserId("emp-1"), null);
});

test("reads Bhutan wall time as +06:00", () => {
  assert.equal(zkTimeZoneValue("Asia/Thimphu", new Date("2026-09-28T03:00:00Z")), "6");
  assert.equal(
    wallTimeToIso("2026-09-28 09:15:22", "Asia/Thimphu"),
    "2026-09-28T09:15:22+06:00",
  );
});

test("handshake asks only for attendance records", () => {
  const body = zkHandshake("AF4C183760123", "0", "Asia/Thimphu");
  assert.match(body, /GET OPTION FROM: AF4C183760123/);
  assert.match(body, /TransFlag=1000000000/);
  assert.match(body, /Realtime=1/);
  assert.match(body, /TimeZone=6/);
  assert.equal(body.includes("EnrollFP"), false);
  assert.equal(body.includes("AttPhoto\t"), false);
});

test("maps ZK status codes", () => {
  assert.equal(zkStatusToIntent("0"), "clock_in");
  assert.equal(zkStatusToIntent("1"), "clock_out");
  assert.equal(zkStatusToIntent("2"), "break_start");
  assert.equal(zkStatusToIntent("3"), "break_end");
  assert.equal(zkStatusToIntent("255"), "auto");
  assert.equal(zkStatusToIntent(""), "auto");
});

test("alternates punches when the clock always sends check-in", () => {
  assert.deepEqual(
    resolveZkKind({
      intent: "clock_in",
      previous: null,
      crossedDay: false,
      withinDebounce: false,
    }),
    { actions: ["clock_in"] },
  );
  assert.deepEqual(
    resolveZkKind({
      intent: "clock_in",
      previous: "clock_in",
      crossedDay: false,
      withinDebounce: false,
    }),
    { actions: ["clock_out"] },
  );
  assert.deepEqual(
    resolveZkKind({
      intent: "clock_in",
      previous: "clock_out",
      crossedDay: false,
      withinDebounce: false,
    }),
    { actions: ["clock_in"] },
  );
});

test("honors an explicit clock-out and skips a second scan", () => {
  assert.deepEqual(
    resolveZkKind({
      intent: "clock_out",
      previous: "clock_in",
      crossedDay: false,
      withinDebounce: false,
    }),
    { actions: ["clock_out"] },
  );
  assert.deepEqual(
    resolveZkKind({
      intent: "clock_out",
      previous: null,
      crossedDay: false,
      withinDebounce: false,
    }),
    { skip: true },
  );
  assert.deepEqual(
    resolveZkKind({
      intent: "clock_in",
      previous: "clock_in",
      crossedDay: false,
      withinDebounce: true,
    }),
    { skip: true },
  );
});

test("closes an open shift on the next day's arrival", () => {
  assert.deepEqual(
    resolveZkKind({
      intent: "clock_in",
      previous: "clock_in",
      crossedDay: true,
      withinDebounce: false,
    }),
    { actions: ["clock_out", "clock_in"] },
  );
  assert.deepEqual(
    resolveZkKind({
      intent: "clock_in",
      previous: "break_start",
      crossedDay: true,
      withinDebounce: false,
    }),
    { actions: ["break_end", "clock_out", "clock_in"] },
  );
});

test("parses tab, space, and key attendance lines", () => {
  const rows = parseAttlog(
    [
      "1\t2026-09-28 09:15:22\t0\t1\t0\t0",
      "2 2026-09-28 17:01:03 1",
      "pin=15\tdatetime=2026-09-28 18:00:00\tstatus=0",
      "not a punch",
      "",
    ].join("\n") + "\0",
  );
  assert.deepEqual(rows, [
    { pin: "1", wall: "2026-09-28 09:15:22", status: "0" },
    { pin: "2", wall: "2026-09-28 17:01:03", status: "1" },
    { pin: "15", wall: "2026-09-28 18:00:00", status: "0" },
  ]);
});
