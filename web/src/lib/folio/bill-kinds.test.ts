import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BILL_KIND_LABELS,
  classifyBillLine,
  lineBelongsOnBill,
  parseBillKind,
} from "./bill-kinds";

describe("bill process kinds", () => {
  it("parses Master / Room / F&B", () => {
    assert.equal(parseBillKind("master"), "master");
    assert.equal(parseBillKind("room"), "room");
    assert.equal(parseBillKind("fnb"), "fnb");
    assert.equal(parseBillKind("other"), "master");
    assert.equal(BILL_KIND_LABELS.master, "Master bill");
  });

  it("classifies room vs F&B vs adj", () => {
    assert.equal(
      classifyBillLine({ source_type: "room", description: "Peak night" }),
      "room",
    );
    assert.equal(
      classifyBillLine({ source_type: "pos", description: "Momos" }),
      "fnb",
    );
    assert.equal(
      classifyBillLine({
        source_type: "adjustment",
        description: "Adj · hotel absorbs · room bill (round to Nu 0 or 5)",
      }),
      "hotel_adj",
    );
  });

  it("filters lines per bill kind", () => {
    const room = { source_type: "room", description: "Night 1" };
    const pos = { source_type: "pos", description: "Dinner" };
    const roomAdj = {
      source_type: "adjustment",
      description: "Adj · hotel absorbs · room bill (round to Nu 0 or 5)",
    };
    assert.equal(lineBelongsOnBill(room, "room"), true);
    assert.equal(lineBelongsOnBill(pos, "room"), false);
    assert.equal(lineBelongsOnBill(roomAdj, "room"), true);
    assert.equal(lineBelongsOnBill(pos, "fnb"), true);
    assert.equal(lineBelongsOnBill(room, "master"), true);
  });
});
