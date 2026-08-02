import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStayHubSteps,
  recommendStayHubStep,
} from "@/lib/folio/stay-hub-cycle";

test("confirmed + sdf incomplete → current Arrival", () => {
  const steps = buildStayHubSteps({
    status: "confirmed",
    hasRoomAssigned: true,
    sdfIncomplete: true,
  });
  const current = steps.find((s) => s.current);
  assert.equal(current?.id, "arrival");
  assert.equal(steps.find((s) => s.id === "arrival")?.done, false);
});

test("checked_in unpaid → current Stay/Money; arrival+check-in done", () => {
  const steps = buildStayHubSteps({
    status: "checked_in",
    hasRoomAssigned: true,
    sdfIncomplete: true,
    hasFolio: true,
    hasCharges: true,
    balanceBtn: 1200,
  });
  assert.equal(steps.find((s) => s.current)?.id, "stay_money");
  assert.equal(steps.find((s) => s.id === "arrival")?.done, true);
  assert.equal(steps.find((s) => s.id === "check_in")?.done, true);
});

test("checked_in settled → current Check-out", () => {
  const steps = buildStayHubSteps({
    status: "checked_in",
    hasRoomAssigned: true,
    hasFolio: true,
    hasCharges: true,
    balanceBtn: 0,
  });
  assert.equal(steps.find((s) => s.current)?.id, "check_out");
});

test("recommendStayHubStep arrivals: checked_in → stay_money", () => {
  assert.equal(
    recommendStayHubStep({
      status: "checked_in",
      board: "arrivals",
      hasRoomAssigned: true,
      balanceBtn: 100,
    }),
    "stay_money",
  );
});

test("recommendStayHubStep arrivals: confirmed incomplete docs → arrival", () => {
  assert.equal(
    recommendStayHubStep({
      status: "confirmed",
      board: "arrivals",
      hasRoomAssigned: true,
      sdfIncomplete: true,
    }),
    "arrival",
  );
});

test("recommendStayHubStep arrivals: confirmed ready → check_in", () => {
  assert.equal(
    recommendStayHubStep({
      status: "confirmed",
      board: "arrivals",
      hasRoomAssigned: true,
      sdfIncomplete: false,
    }),
    "check_in",
  );
});
