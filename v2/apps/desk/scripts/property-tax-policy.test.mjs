import assert from "node:assert/strict";
import { test } from "node:test";

const SC_RATE = 0.1;
const GST_RATE = 0.1;

function propertyTaxBreakdown(net, policy = { scOn: true, gstOn: false }) {
  const netAmount = Math.max(0, Math.round(net));
  const scAmount = policy.scOn ? Math.round(netAmount * SC_RATE) : 0;
  const bstAmount = policy.gstOn
    ? Math.round((netAmount + scAmount) * GST_RATE)
    : 0;
  return {
    netAmount,
    scAmount,
    bstAmount,
    totalAmount: netAmount + scAmount + bstAmount,
  };
}

test("desk default SC on GST off — laundry shirt 80 → 88", () => {
  const t = propertyTaxBreakdown(80);
  assert.equal(t.totalAmount, 88);
  assert.equal(t.bstAmount, 0);
});

test("GST on adds BST — 100 → 121", () => {
  const t = propertyTaxBreakdown(100, { scOn: true, gstOn: true });
  assert.equal(t.totalAmount, 121);
});
