import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertCashBillHasAdvance,
  canIssueCashAdvance,
  reconcileCashAdvance,
} from "./cash-advance.js";
import {
  admsHandshakeBody,
  lateMinutesForPunch,
  parseAttlogBody,
} from "./adms-punch.js";
import {
  daysWorkedFromPunches,
  distributeScTipPool,
} from "./sc-tip-pool.js";
import { assertPersonalFolioCleared } from "./dual-folio.js";
import { maskPartnerCalendar } from "./partner-mask.js";

describe("cash advance law", () => {
  it("blocks cash bill without advance", () => {
    const r = assertCashBillHasAdvance({
      paymentMode: "cash",
      advanceId: null,
      advance: null,
    });
    assert.equal(r.ok, false);
  });

  it("reconciles spent + change = advance", () => {
    const issued = canIssueCashAdvance({
      amountBtn: 15000,
      tillBalanceBtn: 48250,
    });
    assert.equal(issued.ok, true);
    const rec = reconcileCashAdvance({
      advance: {
        id: "a1",
        amountBtn: 15000,
        spentBtn: 0,
        changeReturnedBtn: 0,
        status: "open",
      },
      spentBtn: 13850,
      changeReturnedBtn: 1150,
    });
    assert.equal(rec.ok, true);
    if (rec.ok) assert.equal(rec.tillCreditBtn, 1150);
  });
});

describe("ADMS punch", () => {
  it("parses ATTLOG lines", () => {
    const punches = parseAttlogBody("101\t2026-11-08 07:45:12\t0\t1\n");
    assert.equal(punches.length, 1);
    assert.equal(punches[0]!.employeeCode, "101");
    assert.ok(admsHandshakeBody("ABC123").includes("GET OPTION FROM: ABC123"));
  });

  it("computes late minutes after grace", () => {
    const late = lateMinutesForPunch("2026-11-08T08:20:00+06:00", {
      id: "s1",
      code: "morning",
      startTime: "08:00",
      endTime: "16:00",
      graceMinutes: 10,
    });
    assert.equal(late, 10);
  });
});

describe("SC tip pool", () => {
  it("distributes by points × days", () => {
    const r = distributeScTipPool(10000, [
      { staffId: "a", tipPoints: 2, daysWorked: 10 },
      { staffId: "b", tipPoints: 1, daysWorked: 10 },
    ]);
    assert.equal(r.totalPointDays, 30);
    const a = r.lines.find((l) => l.staffId === "a")!;
    const b = r.lines.find((l) => l.staffId === "b")!;
    assert.equal(a.shareBtn, 6666.67);
    assert.equal(b.shareBtn, 3333.33);
    assert.equal(
      daysWorkedFromPunches(
        ["2026-11-01T08:00:00+06:00", "2026-11-01T17:00:00+06:00", "2026-11-02T08:00:00+06:00"],
        "2026-11",
      ),
      2,
    );
  });
});

describe("dual folio gate", () => {
  it("blocks personal balance > 0.50", () => {
    const r = assertPersonalFolioCleared([
      { payerType: "guest", balanceBtn: 120 },
      { payerType: "agent", balanceBtn: 200000 },
    ]);
    assert.equal(r.ok, false);
  });

  it("allows cleared personal with open master", () => {
    const r = assertPersonalFolioCleared([
      { payerType: "guest", balanceBtn: 0.4 },
      { payerType: "agent", balanceBtn: 200000 },
    ]);
    assert.equal(r.ok, true);
  });
});

describe("partner mask", () => {
  it("masks competitor rooms", () => {
    const cells = maskPartnerCalendar(
      [
        {
          stayDate: "2026-11-08",
          roomId: "r1",
          roomNumber: "201",
          state: "occupied",
          ownerAgentId: "yangphel",
          guestName: "Mr A",
          bookingRef: "PS-1",
          netRateBtn: 5000,
        },
        {
          stayDate: "2026-11-08",
          roomId: "r2",
          roomNumber: "202",
          state: "occupied",
          ownerAgentId: "druk",
          guestName: "Secret",
          bookingRef: "PS-2",
          netRateBtn: 4800,
        },
      ],
      "yangphel",
    );
    assert.equal(cells[0]!.displayState, "own");
    assert.equal(cells[0]!.guestName, "Mr A");
    assert.equal(cells[1]!.displayState, "masked_occupied");
    assert.equal(cells[1]!.label, "Occupied · Tour Group");
    assert.equal(cells[1]!.guestName, null);
    assert.equal(cells[1]!.netRateBtn, null);
  });
});
