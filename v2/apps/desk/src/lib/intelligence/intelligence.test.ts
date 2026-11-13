import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Agent } from "../commercial-store";
import {
  buildAgentIntelligence,
  stayMatchesAgent,
} from "./agent-intelligence";
import {
  buildGuestIntelligence,
  guestMeetsMinData,
} from "./guest-intelligence";
import { buildOpsHrIntelligence } from "./ops-hr-intelligence";
import { averageArrivalGapDays, buildOutlook, median } from "./outlook";

function agent(partial?: Partial<Agent>): Agent {
  return {
    id: "ag-1",
    name: "Soul Trips",
    code: "SOULTRIPS",
    contact: "ops@st.bt",
    creditLimit: 200_000,
    usedCredit: 10_000,
    termsDays: 30,
    rateCardId: "rc-1",
    aging: { current: 0, d30: 0, d60: 0, d90: 0 },
    active: true,
    ...partial,
  };
}

function folio(charged: number, paid = 0) {
  const lines = [
    {
      id: "c1",
      postedAt: "2026-10-01T12:00:00.000Z",
      kind: "room" as const,
      description: "Room",
      netAmount: charged,
      scAmount: 0,
      bstAmount: 0,
      totalAmount: charged,
      voided: false,
      stream: "master" as const,
    },
  ];
  if (paid > 0) {
    lines.push({
      id: "p1",
      postedAt: "2026-10-03T12:00:00.000Z",
      kind: "payment" as const,
      description: "Cash",
      netAmount: -paid,
      scAmount: 0,
      bstAmount: 0,
      totalAmount: -paid,
      voided: false,
      stream: "master" as const,
    });
  }
  return lines;
}

describe("outlook helpers", () => {
  it("median and arrival gap", () => {
    assert.equal(median([1, 3, 2]), 2);
    assert.equal(averageArrivalGapDays(["2026-01-01", "2026-01-11", "2026-01-21"]), 10);
  });

  it("buildOutlook needs two arrivals for medium confidence", () => {
    const o = buildOutlook({
      arrivalDates: ["2026-08-01", "2026-10-01"],
      checkoutDates: ["2026-08-03", "2026-10-03"],
      nightByMonth: new Map([
        ["2026-08", 2],
        ["2026-10", 2],
      ]),
      asOf: "2026-11-13",
    });
    assert.equal(o.medianGapDays, 61);
    assert.ok(o.nextLikelyArrival);
    assert.equal(o.confidence, "medium");
  });
});

describe("agent intelligence", () => {
  it("ranks top agents by room nights and matches agency", () => {
    const a = agent();
    assert.equal(
      stayMatchesAgent(
        {
          id: "1",
          status: "checked_out",
          guestName: "G",
          nationality: "FR",
          agencyName: "Soul Trips",
          source: "agent",
          typeCode: "deluxe_twin",
          mealPlan: "MAP",
          checkIn: "2026-10-01",
          checkOut: "2026-10-03",
          nightlyNet: 5000,
          folioLines: folio(11000),
        },
        a,
      ),
      true,
    );

    const report = buildAgentIntelligence({
      agents: [a, agent({ id: "ag-2", name: "Yak Holidays", code: "YAK", rateCardId: "rc-2" })],
      stays: [
        {
          id: "s1",
          status: "checked_out",
          guestName: "A",
          nationality: "FR",
          agencyName: "Soul Trips",
          source: "agent",
          typeCode: "deluxe_twin",
          mealPlan: "MAP",
          checkIn: "2026-10-01",
          checkOut: "2026-10-04",
          nightlyNet: 5000,
          folioLines: folio(15000),
          stayFlags: ["extra pillow"],
          notes: "Quiet room",
        },
        {
          id: "s2",
          status: "checked_out",
          guestName: "B",
          nationality: "DE",
          agencyName: "Soul Trips",
          source: "agent",
          typeCode: "deluxe_king",
          mealPlan: "CP",
          checkIn: "2026-09-01",
          checkOut: "2026-09-02",
          nightlyNet: 4000,
          folioLines: folio(4000, 4000),
        },
        {
          id: "s3",
          status: "checked_out",
          guestName: "C",
          nationality: "BT",
          agencyName: "Yak Holidays",
          source: "agent",
          typeCode: "suite",
          mealPlan: "EP",
          checkIn: "2026-10-10",
          checkOut: "2026-10-11",
          nightlyNet: 8000,
          folioLines: folio(8000),
        },
      ],
      from: "2026-09-01",
      to: "2026-10-31",
      asOf: "2026-11-13",
      topN: 10,
    });

    assert.equal(report.top[0]?.agentCode, "SOULTRIPS");
    assert.equal(report.top[0]?.roomNights, 4);
    assert.ok(report.top[0]?.nationalityMix.some((n) => n.key === "FR"));
    assert.ok(report.top[0]?.cues.menuCues.length > 0);
  });
});

describe("guest min-data gate", () => {
  it("passes with 2 checked-out stays", () => {
    const stays = [
      {
        id: "1",
        status: "checked_out" as const,
        guestName: "Ada",
        nationality: "",
        passportOrCid: "",
        agencyName: null,
        typeCode: "deluxe_twin",
        mealPlan: "MAP" as const,
        checkIn: "2026-08-01",
        checkOut: "2026-08-03",
        nightlyNet: 1,
        folioLines: folio(100),
      },
      {
        id: "2",
        status: "checked_out" as const,
        guestName: "Ada",
        nationality: "",
        passportOrCid: "",
        agencyName: null,
        typeCode: "deluxe_twin",
        mealPlan: "MAP" as const,
        checkIn: "2026-10-01",
        checkOut: "2026-10-02",
        nightlyNet: 1,
        folioLines: folio(100),
      },
    ];
    assert.equal(guestMeetsMinData(stays, "", "").ok, true);
  });

  it("needs passport and nationality for single stay", () => {
    const stays = [
      {
        id: "1",
        status: "checked_out" as const,
        guestName: "Bob",
        nationality: "FR",
        passportOrCid: "",
        agencyName: null,
        typeCode: "deluxe_twin",
        mealPlan: "CP" as const,
        checkIn: "2026-10-01",
        checkOut: "2026-10-02",
        nightlyNet: 1,
        folioLines: folio(100),
      },
    ];
    const g = guestMeetsMinData(stays, "", "FR");
    assert.equal(g.ok, false);
    if (!g.ok) assert.ok(g.missing.includes("passportOrCid"));
  });

  it("splits dossiers vs needMoreData", () => {
    const report = buildGuestIntelligence({
      stays: [
        {
          id: "1",
          status: "checked_out",
          guestName: "Rich",
          nationality: "US",
          passportOrCid: "P123",
          agencyName: "Soul Trips",
          typeCode: "deluxe_king",
          mealPlan: "MAP",
          checkIn: "2026-10-01",
          checkOut: "2026-10-03",
          nightlyNet: 5000,
          folioLines: folio(10000),
        },
        {
          id: "2",
          status: "checked_out",
          guestName: "Thin",
          nationality: "",
          passportOrCid: "",
          agencyName: null,
          typeCode: "deluxe_twin",
          mealPlan: "EP",
          checkIn: "2026-10-05",
          checkOut: "2026-10-06",
          nightlyNet: 3000,
          folioLines: folio(3000),
        },
      ],
      from: "2026-10-01",
      to: "2026-10-31",
      asOf: "2026-11-13",
    });
    assert.equal(report.dossiers.length, 1);
    assert.equal(report.needMoreData.length, 1);
    assert.equal(report.dossiers[0]?.guestName, "Rich");
  });
});

describe("ops hr intelligence", () => {
  it("computes occ and staffing recommendations without payroll", () => {
    const report = buildOpsHrIntelligence({
      roomsCount: 20,
      from: "2026-10-01",
      to: "2026-10-10",
      asOf: "2026-11-13",
      stays: [
        {
          id: "s1",
          status: "checked_out",
          checkIn: "2026-10-01",
          checkOut: "2026-10-05",
          nightlyNet: 5000,
          folioLines: folio(20000),
          roomId: "rm-1",
        },
      ],
      staff: [],
    });
    assert.equal(report.roomNightsSold, 4);
    assert.ok(report.occPct > 0);
    assert.equal(report.payrollNetMonthly, null);
    assert.ok(report.byDept.some((d) => d.dept.includes("Housekeeping") || d.dept === "Housekeeping"));
    assert.ok(report.notes.length > 0);
  });
});
