import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GARMENT_RATES,
  laundryBagDescription,
  laundryBagPreviewNet,
  laundryLineNet,
} from "./laundry-pricing.js";

describe("laundry bag pricing", () => {
  it("previews net for catalog + custom + express", () => {
    const lines = [
      { qty: 2, unitNet: GARMENT_RATES.shirt },
      { qty: 1, unitNet: 150 }, // custom Kids jacket
    ];
    // base = 2*80 + 150 = 310; wash_iron × express 1.5 = 465
    assert.equal(laundryLineNet(lines), 310);
    assert.equal(laundryBagPreviewNet(lines, "wash_iron", "express"), 465);
    assert.equal(laundryBagPreviewNet(lines, "dry_clean", "normal"), Math.round(310 * 1.4));
  });

  it("builds folio description with cloth names and qty", () => {
    const desc = laundryBagDescription({
      bagNo: "LB-0041",
      service: "wash_iron",
      speed: "express",
      garments: [
        { label: "Shirt", qty: 2 },
        { label: "Kids jacket", qty: 1 },
      ],
    });
    assert.match(desc, /LB-0041/);
    assert.match(desc, /Shirt×2/);
    assert.match(desc, /Kids jacket×1/);
    assert.match(desc, /Wash & Iron/);
    assert.match(desc, /express/);
  });
});
