import assert from "node:assert/strict";
import test from "node:test";
import {
  buildArrivalPlaybook,
  buildStayStoryLine,
  foPaymentModeLabel,
  foPaymentModeShort,
} from "./fo-settlement";

test("foPaymentModeLabel maps FO speech", () => {
  assert.equal(foPaymentModeLabel("cash"), "Guest pays at leave");
  assert.equal(foPaymentModeLabel("on_credit"), "Agent on credit (guide signs)");
  assert.equal(foPaymentModeShort("cash"), "Pay at leave");
});

test("buildStayStoryLine composes journey sentence", () => {
  const line = buildStayStoryLine({
    status: "confirmed",
    roomLabel: "204",
    hkStatus: "dirty",
    dueBtn: 4200,
    paymentMode: "on_credit",
    agentName: "Jaigaon Tours",
  });
  assert.match(line, /Confirmed/);
  assert.match(line, /204 dirty/);
  assert.match(line, /4,200/);
  assert.match(line, /Agent on credit/);
});

test("buildArrivalPlaybook: unassigned → assign current", () => {
  const steps = buildArrivalPlaybook({
    status: "confirmed",
    hasRoomAssigned: false,
  });
  assert.equal(steps.find((s) => s.id === "assign")?.current, true);
  assert.equal(steps.find((s) => s.id === "assign")?.done, false);
});

test("buildArrivalPlaybook: assigned confirmed → CI current", () => {
  const steps = buildArrivalPlaybook({
    status: "confirmed",
    hasRoomAssigned: true,
  });
  assert.equal(steps.find((s) => s.id === "assign")?.done, true);
  assert.equal(steps.find((s) => s.id === "check_in")?.current, true);
});
