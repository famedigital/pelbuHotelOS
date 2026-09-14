import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isPastNightAuditCloseTime,
  localHmInTimezone,
  normalizeCloseTime,
  parseCloseTime,
} from "@/lib/night-audit/close-time";

describe("night-audit close_time", () => {
  it("normalizes and parses HH:MM", () => {
    assert.equal(normalizeCloseTime("9:05"), "00:00"); // invalid → default via parse
    assert.deepEqual(parseCloseTime("18:30"), { hours: 18, minutes: 30 });
    assert.equal(normalizeCloseTime("18:30"), "18:30");
  });

  it("formats local HM in Thimphu", () => {
    const noonUtc = new Date("2026-08-01T06:00:00.000Z"); // 12:00 Asia/Thimphu
    assert.equal(localHmInTimezone(noonUtc, "Asia/Thimphu"), "12:00");
  });

  it("gates cron until close_time", () => {
    const morning = new Date("2026-08-01T01:00:00.000Z"); // 07:00 Thimphu
    assert.equal(
      isPastNightAuditCloseTime({
        now: morning,
        timeZone: "Asia/Thimphu",
        closeTime: "00:00",
      }),
      true,
    );
    assert.equal(
      isPastNightAuditCloseTime({
        now: morning,
        timeZone: "Asia/Thimphu",
        closeTime: "18:00",
      }),
      false,
    );
    const evening = new Date("2026-08-01T12:30:00.000Z"); // 18:30 Thimphu
    assert.equal(
      isPastNightAuditCloseTime({
        now: evening,
        timeZone: "Asia/Thimphu",
        closeTime: "18:00",
      }),
      true,
    );
  });
});
