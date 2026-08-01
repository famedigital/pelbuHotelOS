import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allocateSplitGst } from "./split-gst";

describe("allocateSplitGst", () => {
  it("allocates GST proportional to tender share", () => {
    assert.equal(allocateSplitGst(500, 1000, 100), 50);
  });

  it("returns 0 when order has no GST", () => {
    assert.equal(allocateSplitGst(500, 1000, 0), 0);
  });

  it("returns 0 when order total is zero", () => {
    assert.equal(allocateSplitGst(100, 0, 50), 0);
  });
});
