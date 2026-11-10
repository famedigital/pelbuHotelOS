import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeCancelWaivers,
  daysUntilCheckIn,
  isMouAgentFromBooking,
} from "./cancel-policy-logic";

describe("cancel-policy-logic", () => {
  it("waives cancel fee for MoU agent when mou_free_cancel", () => {
    const { waiveCancelFee, waiveNoShowFee } = computeCancelWaivers({
      isMouAgent: true,
      freeCancelDays: 3,
      daysUntilCheckIn: 0,
      mouFreeCancel: true,
      mouWaiveNoShow: true,
    });
    assert.equal(waiveCancelFee, true);
    assert.equal(waiveNoShowFee, true);
  });

  it("charges late cancel when inside free window and not MoU", () => {
    const { waiveCancelFee } = computeCancelWaivers({
      isMouAgent: false,
      freeCancelDays: 3,
      daysUntilCheckIn: 1,
      mouFreeCancel: true,
      mouWaiveNoShow: false,
    });
    assert.equal(waiveCancelFee, false);
  });

  it("free cancel when enough days before arrival", () => {
    const { waiveCancelFee } = computeCancelWaivers({
      isMouAgent: false,
      freeCancelDays: 3,
      daysUntilCheckIn: 5,
      mouFreeCancel: false,
      mouWaiveNoShow: false,
    });
    assert.equal(waiveCancelFee, true);
  });

  it("daysUntilCheckIn counts calendar days", () => {
    const from = new Date("2026-08-10T12:00:00.000Z");
    assert.equal(daysUntilCheckIn("2026-08-15", from), 5);
  });

  it("isMouAgentFromBooking respects role and agent flag", () => {
    assert.equal(isMouAgentFromBooking("mou_agent", false), true);
    assert.equal(isMouAgentFromBooking("agent", true), true);
    assert.equal(isMouAgentFromBooking("agent", false), false);
  });
});
