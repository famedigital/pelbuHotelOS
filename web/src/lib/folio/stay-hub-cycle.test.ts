import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFolioPageHref,
  buildStayHubReopenHref,
  buildStayHubSteps,
  canNavigateStayHubStep,
  deskFocusedSteps,
  isStayHubArrivalTooFar,
  previousStayHubPanel,
  recommendStayHubStep,
  stayHubBackTargetLabel,
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

test("checked_in settled → domain current Folio (leave is explicit)", () => {
  const steps = buildStayHubSteps({
    status: "checked_in",
    hasRoomAssigned: true,
    hasFolio: true,
    hasCharges: true,
    balanceBtn: 0,
  });
  assert.equal(steps.find((s) => s.current)?.id, "stay_money");
});

test("forceCurrent panel check_out highlights Checkout while settled", () => {
  const steps = buildStayHubSteps({
    status: "checked_in",
    hasRoomAssigned: true,
    hasFolio: true,
    hasCharges: true,
    balanceBtn: 0,
    forceCurrent: "check_out",
  });
  assert.equal(steps.find((s) => s.current)?.id, "check_out");
});

test("recommendStayHubStep: checked_in always Folio (incl. departures)", () => {
  assert.equal(
    recommendStayHubStep({
      status: "checked_in",
      board: "departures",
      hasRoomAssigned: true,
      balanceBtn: 0,
    }),
    "stay_money",
  );
  assert.equal(
    recommendStayHubStep({
      status: "checked_in",
      board: "auto",
      hasRoomAssigned: true,
      balanceBtn: 0,
    }),
    "stay_money",
  );
  assert.equal(
    recommendStayHubStep({
      status: "checked_in",
      board: "in_house",
      balanceBtn: 2890,
    }),
    "stay_money",
  );
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

test("recommendStayHubStep arrivals: confirmed incomplete docs → check_in (docs still flagged in hub)", () => {
  assert.equal(
    recommendStayHubStep({
      status: "confirmed",
      board: "arrivals",
      hasRoomAssigned: true,
      sdfIncomplete: true,
    }),
    "check_in",
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

test("previousStayHubPanel: checkout → folio; folio → check-in in-house", () => {
  assert.equal(previousStayHubPanel("check_out", "checked_in"), "stay_money");
  assert.equal(previousStayHubPanel("stay_money", "checked_in"), "check_in");
  assert.equal(previousStayHubPanel("check_in", "confirmed"), "reserve");
  assert.equal(previousStayHubPanel("check_in", "held"), "confirm");
  assert.equal(previousStayHubPanel("reserve", "confirmed"), null);
  assert.equal(stayHubBackTargetLabel("stay_money", "checked_in"), "Folio");
});

test("deskFocusedSteps: in-house FO hierarchy Details · Check-in · Folio · Checkout", () => {
  const full = buildStayHubSteps({
    status: "checked_in",
    hasRoomAssigned: true,
    hasFolio: true,
    hasCharges: true,
    balanceBtn: 100,
  });
  const desk = deskFocusedSteps(full, "checked_in");
  assert.deepEqual(
    desk.map((s) => s.id),
    ["reserve", "check_in", "stay_money", "check_out"],
  );
  assert.deepEqual(
    desk.map((s) => s.label),
    ["Details", "Check-in", "Folio", "Checkout"],
  );
});

test("canNavigateStayHubStep: completed Folio stays clickable from Checkout", () => {
  const steps = buildStayHubSteps({
    status: "checked_in",
    hasRoomAssigned: true,
    hasFolio: true,
    hasCharges: true,
    balanceBtn: 0,
  });
  const folio = steps.find((s) => s.id === "stay_money");
  assert.equal(
    canNavigateStayHubStep({
      targetId: "stay_money",
      panel: "check_out",
      step: folio,
      status: "checked_in",
    }),
    true,
  );
});

test("future arrival locks check-in until open business date", () => {
  assert.equal(
    isStayHubArrivalTooFar("2026-08-28", "2026-08-11", "confirmed"),
    true,
  );
  assert.equal(
    isStayHubArrivalTooFar("2026-08-11", "2026-08-11", "confirmed"),
    false,
  );
  assert.equal(
    isStayHubArrivalTooFar("2026-08-28", "2026-08-11", "checked_in"),
    false,
  );

  const steps = buildStayHubSteps({
    status: "confirmed",
    hasRoomAssigned: true,
    sdfIncomplete: false,
    checkInDate: "2026-08-28",
    openBusinessDate: "2026-08-11",
  });
  const checkIn = steps.find((s) => s.id === "check_in");
  assert.equal(checkIn?.locked, true);
  assert.match(checkIn?.lockReason ?? "", /2026-08-28/);
  assert.match(checkIn?.lockReason ?? "", /2026-08-11/);
  assert.notEqual(steps.find((s) => s.current)?.id, "check_in");

  assert.equal(
    recommendStayHubStep({
      status: "confirmed",
      board: "arrivals",
      hasRoomAssigned: true,
      checkInDate: "2026-08-28",
      openBusinessDate: "2026-08-11",
    }),
    "arrival",
  );
});

test("buildStayHubReopenHref and buildFolioPageHref stay return context", () => {
  assert.equal(
    buildStayHubReopenHref({
      bookingId: "abc-123",
      panel: "check_out",
      board: "in_house",
    }),
    "/erp/in-house?booking=abc-123&step=check_out",
  );
  assert.equal(
    buildFolioPageHref({
      folioId: "fol-1",
      stayReturn: true,
      bookingId: "abc-123",
      panel: "stay_money",
      board: "in_house",
    }),
    "/erp/folios/fol-1?stay=1&booking=abc-123&panel=stay_money&board=in_house",
  );
  assert.equal(
    buildFolioPageHref({ folioId: "fol-1", pathSuffix: "/receipt" }),
    "/erp/folios/fol-1/receipt",
  );
});
