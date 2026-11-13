import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Agent } from "./commercial-store";
import type { FiscalDoc } from "./extras-store";
import type { Stay } from "./front-office-store";
import {
  anySectionOn,
  buildAgentPrintPack,
  defaultPeriodForAgent,
  sectionsForPreset,
} from "./agent-print-pack";

function agent(partial?: Partial<Agent>): Agent {
  return {
    id: "ag-st",
    name: "Soul Trips",
    code: "SOULTRIPS",
    contact: "ops@soultrips.bt",
    creditLimit: 200_000,
    usedCredit: 50_000,
    termsDays: 30,
    rateCardId: "rc-mou",
    aging: { current: 20_000, d30: 10_000, d60: 5_000, d90: 15_000 },
    active: true,
    ...partial,
  };
}

function stay(partial: Partial<Stay> & Pick<Stay, "id" | "guestName">): Stay {
  const checkIn = partial.checkIn ?? "2026-10-01";
  const checkOut = partial.checkOut ?? "2026-10-03";
  const base: Stay = {
    id: partial.id,
    confirmationNo: partial.confirmationNo ?? `PS-${partial.id}`,
    status: partial.status ?? "checked_out",
    guestName: partial.guestName,
    guestPhone: "",
    guestEmail: "",
    nationality: "BT",
    passportOrCid: "",
    vip: false,
    roomId: "rm-1",
    roomNumber: partial.roomNumber ?? "501",
    typeCode: partial.typeCode ?? "deluxe_twin",
    checkIn,
    checkOut,
    mealPlan: partial.mealPlan ?? "MAP",
    source: "agent",
    nightlyNet: partial.nightlyNet ?? 5000,
    groupId: null,
    groupName: null,
    agencyName: "Soul Trips",
    folioNo: partial.folioNo ?? `SSFN-${partial.id}`,
    taxInvoiceNo: partial.taxInvoiceNo ?? null,
    folioLines: partial.folioLines ?? [
      {
        id: `fl-${partial.id}-room`,
        postedAt: `${checkIn}T12:00:00.000Z`,
        kind: "room",
        description: "Room",
        netAmount: 10_000,
        scAmount: 1_000,
        bstAmount: 0,
        totalAmount: 11_000,
        voided: false,
        stream: "master",
      },
    ],
    holdExpiresAt: null,
    depositPaid: 0,
    audit: [],
    billingMode: "standard",
  };
  return { ...base, ...partial, id: partial.id, guestName: partial.guestName };
}

describe("sectionsForPreset", () => {
  it("clientPack turns master unpaid summary payments aging mou on", () => {
    const s = sectionsForPreset("clientPack");
    assert.equal(s.master, true);
    assert.equal(s.unpaidInvoices, true);
    assert.equal(s.paidInvoices, false);
    assert.equal(s.summary, true);
    assert.equal(s.payments, true);
    assert.equal(s.aging, true);
    assert.equal(s.mou, true);
  });

  it("fullArchive turns all on; clear turns all off", () => {
    const full = sectionsForPreset("fullArchive");
    assert.equal(anySectionOn(full), true);
    assert.equal(full.paidInvoices, true);
    const clear = sectionsForPreset("clear");
    assert.equal(anySectionOn(clear), false);
  });

  it("unpaidOnly is unpaid invoices alone", () => {
    const s = sectionsForPreset("unpaidOnly");
    assert.equal(s.unpaidInvoices, true);
    assert.equal(s.master, false);
    assert.equal(s.paidInvoices, false);
  });
});

describe("defaultPeriodForAgent", () => {
  it("spans first stay check-in to statement date", () => {
    const a = agent();
    const period = defaultPeriodForAgent({
      agent: a,
      stays: [
        stay({ id: "s1", guestName: "A", checkIn: "2026-09-10", checkOut: "2026-09-12" }),
        stay({ id: "s2", guestName: "B", checkIn: "2026-11-01", checkOut: "2026-11-03" }),
      ],
      fiscalDocs: [],
      statementDate: "2026-11-13",
    });
    assert.equal(period.from, "2026-09-10");
    assert.equal(period.to, "2026-11-13");
  });
});

describe("buildAgentPrintPack", () => {
  const unpaidStay = stay({
    id: "u1",
    guestName: "Open Guest",
    checkIn: "2026-10-20",
    checkOut: "2026-10-22",
    folioLines: [
      {
        id: "fl-u1",
        postedAt: "2026-10-20T12:00:00.000Z",
        kind: "room",
        description: "Room MAP",
        netAmount: 10_000,
        scAmount: 1_000,
        bstAmount: 0,
        totalAmount: 11_000,
        voided: false,
        stream: "master",
      },
    ],
  });

  const paidStay = stay({
    id: "p1",
    guestName: "Paid Guest",
    checkIn: "2026-10-01",
    checkOut: "2026-10-03",
    mealPlan: "CP",
    typeCode: "deluxe_king",
    folioLines: [
      {
        id: "fl-p1-room",
        postedAt: "2026-10-01T12:00:00.000Z",
        kind: "room",
        description: "Room CP",
        netAmount: 8_000,
        scAmount: 800,
        bstAmount: 0,
        totalAmount: 8_800,
        voided: false,
        stream: "master",
      },
      {
        id: "fl-p1-pay",
        postedAt: "2026-10-03T12:00:00.000Z",
        kind: "payment",
        description: "mBoB",
        netAmount: -8_800,
        scAmount: 0,
        bstAmount: 0,
        totalAmount: -8_800,
        voided: false,
        stream: "master",
      },
    ],
  });

  const fiscalPaid: FiscalDoc = {
    id: "fd1",
    kind: "PSBN",
    docNo: "PSBN-2026-00001",
    party: "Soul Trips",
    partyType: "agent",
    amount: 36_000,
    status: "paid",
    at: "2026-10-15T10:00:00.000Z",
    guestName: "mBoB batch",
  };

  it("splits unpaid and paid invoices and omits empty paid when section off", () => {
    const pack = buildAgentPrintPack({
      agent: agent(),
      stays: [unpaidStay, paidStay],
      fiscalDocs: [fiscalPaid],
      sections: sectionsForPreset("clientPack"),
      from: "2026-10-01",
      to: "2026-10-31",
      statementDate: "2026-11-13",
    });
    assert.equal(pack.counts.unpaid, 1);
    assert.equal(pack.counts.paid, 2); // stay + fiscal paid
    assert.equal(pack.unpaidInvoices.length, 1);
    assert.equal(pack.paidInvoices.length, 0); // clientPack leaves paid off
    assert.ok(pack.master);
    assert.ok(pack.summary);
    assert.ok(pack.aging);
    assert.equal(pack.aging?.d90, 15_000);
    assert.equal(pack.hasPrintableContent, true);
  });

  it("full archive includes paid invoice pages and payments", () => {
    const pack = buildAgentPrintPack({
      agent: agent(),
      stays: [unpaidStay, paidStay],
      fiscalDocs: [fiscalPaid],
      sections: sectionsForPreset("fullArchive"),
      from: "2026-10-01",
      to: "2026-10-31",
      statementDate: "2026-11-13",
    });
    assert.equal(pack.paidInvoices.length, 2);
    assert.ok(pack.payments.some((p) => p.method === "mBoB"));
    assert.ok(pack.payments.some((p) => p.ref === "PSBN-2026-00001"));
  });

  it("period filter drops stays outside from/to", () => {
    const pack = buildAgentPrintPack({
      agent: agent(),
      stays: [unpaidStay, paidStay],
      fiscalDocs: [],
      sections: sectionsForPreset("fullArchive"),
      from: "2026-10-20",
      to: "2026-10-22",
      statementDate: "2026-11-13",
    });
    assert.equal(pack.counts.soaLines, 1);
    assert.equal(pack.unpaidInvoices.length, 1);
    assert.equal(pack.paidInvoices.length, 0);
  });

  it("clear sections yields no printable content", () => {
    const pack = buildAgentPrintPack({
      agent: agent(),
      stays: [unpaidStay],
      fiscalDocs: [],
      sections: sectionsForPreset("clear"),
      from: "2026-10-01",
      to: "2026-10-31",
    });
    assert.equal(pack.hasPrintableContent, false);
    assert.equal(pack.master, null);
    assert.equal(pack.unpaidInvoices.length, 0);
  });

  it("summary buckets nights by month and meal", () => {
    const pack = buildAgentPrintPack({
      agent: agent(),
      stays: [unpaidStay, paidStay],
      fiscalDocs: [],
      sections: { ...sectionsForPreset("clear"), summary: true },
      from: "2026-10-01",
      to: "2026-10-31",
    });
    assert.ok(pack.summary);
    assert.ok(pack.summary!.byMonth.some((m) => m.key === "2026-10"));
    assert.ok(pack.summary!.byMealPlan.some((m) => m.key === "MAP"));
    assert.ok(pack.summary!.byMealPlan.some((m) => m.key === "CP"));
  });
});
