import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { stayPax } from "./stay-pax.ts";

describe("stayPax", () => {
  it("falls back to 1 when adults and children are both missing", () => {
    assert.equal(stayPax({}), 1);
    assert.equal(stayPax({ adults: null, children: null }), 1);
    assert.equal(stayPax({ adults: undefined, children: undefined }), 1);
  });

  it("never invents silent double occupancy (no ?? 2)", () => {
    assert.notEqual(stayPax({}), 2);
  });

  it("sums adults + children when present", () => {
    assert.equal(stayPax({ adults: 2, children: 1 }), 3);
    assert.equal(stayPax({ adults: 1 }), 1);
    assert.equal(stayPax({ children: 2 }), 2);
    assert.equal(stayPax({ adults: 0, children: 0 }), 1);
  });
});
