import assert from "node:assert/strict";
import test from "node:test";
import { deriveAgentPayStatus } from "@/lib/erp/daily-desk";

test("deriveAgentPayStatus: settled folio is paid", () => {
  assert.equal(
    deriveAgentPayStatus({ balanceBtn: 0, paymentMode: "cash" }),
    "paid",
  );
  assert.equal(
    deriveAgentPayStatus({ balanceBtn: 0.2, paymentMode: "agent_credit" }),
    "paid",
  );
});

test("deriveAgentPayStatus: open agent bill is agent_ar_open", () => {
  assert.equal(
    deriveAgentPayStatus({ balanceBtn: 5700, paymentMode: "agent_credit" }),
    "agent_ar_open",
  );
  assert.equal(
    deriveAgentPayStatus({ balanceBtn: 100, paymentMode: "bill_to_agent" }),
    "agent_ar_open",
  );
});

test("deriveAgentPayStatus: open guest balance is unpaid", () => {
  assert.equal(
    deriveAgentPayStatus({ balanceBtn: 1200, paymentMode: "cash" }),
    "unpaid",
  );
  assert.equal(
    deriveAgentPayStatus({ balanceBtn: 50, paymentMode: null }),
    "unpaid",
  );
});
