import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFolioReceiptMessage,
  buildPosReceiptMessage,
  receiptWaShareHref,
  usableGuestPhone,
} from "./pos-receipt-message";

describe("usableGuestPhone", () => {
  it("rejects walk-in placeholders", () => {
    assert.equal(usableGuestPhone("walk-in"), null);
    assert.equal(usableGuestPhone("Walk-In"), null);
  });

  it("keeps real numbers", () => {
    assert.equal(usableGuestPhone("+975 17 123 456"), "97517123456");
  });
});

describe("receiptWaShareHref", () => {
  it("targets a number when present", () => {
    const href = receiptWaShareHref("97517123456", "Hello");
    assert.match(href, /wa\.me\/97517123456/);
    assert.match(href, /text=/);
  });

  it("falls back to compose without a number", () => {
    const href = receiptWaShareHref(null, "Hello");
    assert.ok(href.startsWith("https://wa.me/?text="));
  });
});

describe("buildPosReceiptMessage", () => {
  it("includes lines, SC, and total", () => {
    const text = buildPosReceiptMessage({
      propertyName: "Pelbu Suites",
      orderId: "38cf6590-fbd8-49f6-b670-954653a94ab3",
      customerName: "Walk-in",
      outlet: "cafe",
      createdAt: "2026-10-15T08:40:00.000Z",
      settledAt: null,
      subtotalBtn: 2210,
      serviceChargeBtn: 221,
      gstBtn: 0,
      totalBtn: 2431,
      unpaid: true,
      lines: [
        {
          name: "Chola Batura",
          qty: 5,
          unitPriceBtn: 250,
          lineTotalBtn: 1250,
        },
        {
          name: "Sprite",
          qty: 1,
          unitPriceBtn: 100,
          lineTotalBtn: 100,
        },
      ],
    });
    assert.match(text, /PB-38CF65/);
    assert.match(text, /Chola Batura/);
    assert.match(text, /Service charge/);
    assert.match(text, /unpaid/);
    assert.match(text, /Total: Nu/);
  });
});

describe("buildFolioReceiptMessage", () => {
  it("shows balance", () => {
    const text = buildFolioReceiptMessage({
      propertyName: "Pelbu Suites",
      folioLabel: "Guest",
      docNo: "RCP-2026-0001",
      guestName: "Rahul",
      chargesSum: 5400,
      paymentsSum: 1000,
      lines: [
        { description: "Room", totalBtn: 5400 },
        { description: "Payment", totalBtn: -1000, isPayment: true },
      ],
    });
    assert.match(text, /RCP-2026-0001/);
    assert.match(text, /Balance/);
  });
});
