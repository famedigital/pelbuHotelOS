import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  anyShiftCoversLocalNow,
  isDeskShiftBypassStaff,
  shiftCoversLocalNow,
} from "./desk-shift-gate";

describe("isDeskShiftBypassStaff", () => {
  it("bypasses owner/gm/manager access and desk roles", () => {
    assert.equal(isDeskShiftBypassStaff({ accessLevel: "owner" }), true);
    assert.equal(isDeskShiftBypassStaff({ accessLevel: "gm" }), true);
    assert.equal(isDeskShiftBypassStaff({ accessLevel: "manager" }), true);
    assert.equal(isDeskShiftBypassStaff({ deskRole: "owner" }), true);
    assert.equal(isDeskShiftBypassStaff({ deskRole: "gm" }), true);
    assert.equal(isDeskShiftBypassStaff({ deskRole: "manager" }), true);
  });

  it("does not bypass line front_desk / employee", () => {
    assert.equal(
      isDeskShiftBypassStaff({
        accessLevel: "employee",
        deskRole: "front_desk",
      }),
      false,
    );
    assert.equal(
      isDeskShiftBypassStaff({ accessLevel: "cashier", deskRole: "cashier" }),
      false,
    );
  });
});

describe("shiftCoversLocalNow", () => {
  it("covers same-day daytime shift half-open [start, end)", () => {
    const shift = {
      shift_date: "2026-08-04",
      starts_at: "09:00:00",
      ends_at: "17:00:00",
    };
    assert.equal(shiftCoversLocalNow(shift, "2026-08-04", 9 * 60), true);
    assert.equal(shiftCoversLocalNow(shift, "2026-08-04", 12 * 60 + 30), true);
    assert.equal(shiftCoversLocalNow(shift, "2026-08-04", 17 * 60), false);
    assert.equal(shiftCoversLocalNow(shift, "2026-08-04", 8 * 60 + 59), false);
  });

  it("covers overnight shift into the next morning", () => {
    const shift = {
      shift_date: "2026-08-04",
      starts_at: "22:00",
      ends_at: "06:00",
    };
    assert.equal(shiftCoversLocalNow(shift, "2026-08-04", 22 * 60), true);
    assert.equal(shiftCoversLocalNow(shift, "2026-08-04", 23 * 60 + 30), true);
    assert.equal(shiftCoversLocalNow(shift, "2026-08-05", 5 * 60 + 59), true);
    assert.equal(shiftCoversLocalNow(shift, "2026-08-05", 6 * 60), false);
    assert.equal(shiftCoversLocalNow(shift, "2026-08-03", 23 * 60), false);
  });
});

describe("anyShiftCoversLocalNow", () => {
  it("returns true when at least one shift covers the instant", () => {
    // 2026-08-04 12:00 Asia/Thimphu = 06:00 UTC
    const noonThimphu = new Date("2026-08-04T06:00:00.000Z");
    const shifts = [
      { shift_date: "2026-08-04", starts_at: "09:00", ends_at: "17:00" },
    ];
    assert.equal(anyShiftCoversLocalNow(shifts, noonThimphu), true);
    assert.equal(
      anyShiftCoversLocalNow(
        [{ shift_date: "2026-08-04", starts_at: "18:00", ends_at: "22:00" }],
        noonThimphu,
      ),
      false,
    );
  });
});
