import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { effectiveGstRate } from "./property-settings";

describe("effectiveGstRate", () => {
  it("returns 0 when the hotel GST switch is off", () => {
    assert.equal(effectiveGstRate({ gst_enabled: false, gst_rate: 0.05 }), 0);
  });

  it("uses the saved rate when GST is on", () => {
    assert.equal(effectiveGstRate({ gst_enabled: true, gst_rate: 0.05 }), 0.05);
  });
});
