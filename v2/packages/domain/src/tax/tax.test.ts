import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateFromAllIn,
  calculateFromNet,
  quoteNight,
  DEFAULT_GST_RATE,
  DEFAULT_SC_RATE,
} from "./index.js";

describe("room night tax SC→GST", () => {
  it("5000 net → SC 500 → GST 275 → total 5775", () => {
    const q = calculateFromNet(5000, {
      serviceChargeRate: DEFAULT_SC_RATE,
      gstRate: DEFAULT_GST_RATE,
    });
    assert.equal(q.amountBtn, 5000);
    assert.equal(q.serviceChargeBtn, 500);
    assert.equal(q.gstBtn, 275);
    assert.equal(q.totalBtn, 5775);
  });

  it("all-in 5775 → net 5000", () => {
    const q = calculateFromAllIn(5775, {
      serviceChargeRate: 0.1,
      gstRate: 0.05,
    });
    assert.equal(q.amountBtn, 5000);
    assert.equal(q.serviceChargeBtn, 500);
    assert.equal(q.gstBtn, 275);
    assert.equal(q.totalBtn, 5775);
  });

  it("SC-exempt → 5250", () => {
    const q = calculateFromNet(5000, {
      serviceChargeRate: 0.1,
      gstRate: 0.05,
      scApplicable: false,
    });
    assert.equal(q.serviceChargeBtn, 0);
    assert.equal(q.gstBtn, 250);
    assert.equal(q.totalBtn, 5250);
  });

  it("quoteNight modes agree on net storage", () => {
    const net = quoteNight(5000, "net");
    const fromAllIn = quoteNight(net.totalBtn, "all_in");
    assert.equal(fromAllIn.amountBtn, net.amountBtn);
  });
});
