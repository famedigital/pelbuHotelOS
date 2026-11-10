import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyDeskPathname,
  primarySurfaceShare,
} from "./desk-surface-metrics";

describe("desk surface classify (StayView + Hub)", () => {
  it("maps stayview and today to stayview", () => {
    assert.equal(classifyDeskPathname("/erp/stayview", ""), "stayview");
    assert.equal(classifyDeskPathname("/erp/today", ""), "stayview");
  });

  it("maps booking query to hub", () => {
    assert.equal(
      classifyDeskPathname("/erp/stayview", "booking=abc&step=stay_money"),
      "hub",
    );
  });

  it("maps pos and night close", () => {
    assert.equal(classifyDeskPathname("/erp/pos", ""), "pos");
    assert.equal(classifyDeskPathname("/erp/night-audit", ""), "night_close");
  });

  it("computes primary share", () => {
    assert.ok(
      Math.abs(
        primarySurfaceShare({
          stayview: 2,
          hub: 2,
          pos: 1,
          night_close: 0,
          settings: 0,
          other: 1,
          startedAt: "",
        }) -
          5 / 6,
      ) < 0.001,
    );
  });
});
