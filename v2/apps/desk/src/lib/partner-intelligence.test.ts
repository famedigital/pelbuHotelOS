import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FiscalDoc } from "./extras-store.js";
import type { Stay } from "./front-office-store.js";
import {
  buildPartnerInvoices,
  filterPartnerInvoices,
  filterPartnerInvoicesBySource,
} from "./partner-intelligence.js";

function stay(partial: Partial<Stay> & Pick<Stay, "id" | "guestName">): Stay {
  const checkIn = partial.checkIn ?? "2026-10-01";
  const checkOut = partial.checkOut ?? "2026-10-03";
  const base: Stay = {
    id: partial.id,
    confirmationNo: partial.confirmationNo ?? `PS-${partial.id}`,
    status: partial.status ?? "confirmed",
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
    folioLines: partial.folioLines ?? [],
    holdExpiresAt: null,
    depositPaid: 0,
    audit: [],
    billingMode: "standard",
  };
  return { ...base, ...partial, id: partial.id, guestName: partial.guestName };
}

function roomCharge(id: string, total: number, postedAt = "2026-10-01T12:00:00.000Z") {
  const net = Math.round(total / 1.1);
  const sc = total - net;
  return {
    id,
    postedAt,
    kind: "room" as const,
    description: "Room",
    netAmount: net,
    scAmount: sc,
    bstAmount: 0,
    totalAmount: total,
    voided: false,
    stream: "master" as const,
  };
}

function payment(id: string, total: number, postedAt = "2026-10-03T12:00:00.000Z") {
  return {
    id,
    postedAt,
    kind: "payment" as const,
    description: "Wire",
    netAmount: -Math.abs(total),
    scAmount: 0,
    bstAmount: 0,
    totalAmount: -Math.abs(total),
    voided: false,
    stream: "master" as const,
  };
}

describe("buildPartnerInvoices hygiene", () => {
  it("excludes confirmed stays with empty folios (no invented AR)", () => {
    const rows = buildPartnerInvoices({
      agencyToken: "SOULTRIPS",
      agencyLabel: "Soul Trips",
      fiscalDocs: [],
      stays: [
        stay({
          id: "empty",
          guestName: "Empty Hold",
          status: "confirmed",
          nightlyNet: 8000,
          folioLines: [],
        }),
      ],
    });
    assert.equal(rows.length, 0);
  });

  it("includes working folio with real open balance only", () => {
    const rows = buildPartnerInvoices({
      agencyToken: "SOULTRIPS",
      agencyLabel: "Soul Trips",
      fiscalDocs: [],
      stays: [
        stay({
          id: "open",
          guestName: "Open Guest",
          status: "checked_in",
          confirmationNo: "XLS-OPEN1",
          folioLines: [roomCharge("c1", 12_800)],
        }),
      ],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.source, "stay");
    assert.equal(rows[0]?.status, "unpaid");
    assert.equal(rows[0]?.balance, 12_800);
    assert.equal(rows[0]?.amount, 12_800);
    assert.ok(!rows[0]?.docNo.includes("estimated"));
  });

  it("includes settled checked_out folios as paid", () => {
    const rows = buildPartnerInvoices({
      agencyToken: "SOULTRIPS",
      agencyLabel: "Soul Trips",
      fiscalDocs: [],
      stays: [
        stay({
          id: "paid",
          guestName: "Paid Guest",
          status: "checked_out",
          confirmationNo: "XLS-PAID1",
          folioLines: [roomCharge("c1", 10_000), payment("p1", 10_000)],
        }),
      ],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.status, "paid");
    assert.equal(rows[0]?.balance, 0);
    assert.equal(rows[0]?.amount, 10_000);
  });

  it("merges fiscal docs and skips stay when stayRef already covered", () => {
    const fiscal: FiscalDoc = {
      id: "fd-1",
      kind: "INV",
      docNo: "INV-2026-0001",
      party: "Soul Trips",
      partyType: "agent",
      amount: 22_000,
      status: "issued",
      at: "2026-10-05T10:00:00.000Z",
      guestName: "Fiscal Guest",
      stayRef: "XLS-COVERED",
      stayId: "covered",
    };
    const rows = buildPartnerInvoices({
      agencyToken: "SOULTRIPS",
      agencyLabel: "Soul Trips",
      fiscalDocs: [fiscal],
      stays: [
        stay({
          id: "covered",
          guestName: "Fiscal Guest",
          status: "checked_out",
          confirmationNo: "XLS-COVERED",
          folioLines: [roomCharge("c1", 22_000)],
        }),
      ],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.source, "fiscal");
    assert.equal(rows[0]?.docNo, "INV-2026-0001");
    assert.equal(rows[0]?.status, "unpaid");
    assert.equal(rows[0]?.balance, 22_000);
  });
});

describe("filterPartnerInvoicesBySource", () => {
  it("isolates fiscal vs working", () => {
    const rows = buildPartnerInvoices({
      agencyToken: "SOULTRIPS",
      agencyLabel: "Soul Trips",
      fiscalDocs: [
        {
          id: "fd-2",
          kind: "PSBN",
          docNo: "PSBN-9",
          party: "SOULTRIPS",
          partyType: "agent",
          amount: 5000,
          status: "paid",
          at: "2026-09-01T10:00:00.000Z",
        },
      ],
      stays: [
        stay({
          id: "w1",
          guestName: "Working",
          status: "checked_in",
          confirmationNo: "XLS-W1",
          folioLines: [roomCharge("c1", 3000)],
        }),
      ],
    });
    assert.equal(filterPartnerInvoicesBySource(rows, "fiscal").length, 1);
    assert.equal(filterPartnerInvoicesBySource(rows, "working").length, 1);
    assert.equal(filterPartnerInvoicesBySource(rows, "all").length, 2);
    assert.equal(filterPartnerInvoices(rows, "unpaid").length, 1);
    assert.equal(filterPartnerInvoices(rows, "paid").length, 1);
  });
});
