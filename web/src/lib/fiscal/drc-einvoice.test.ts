import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  StubBhutanEinvoiceClient,
  type EinvoicePayload,
} from "@/lib/fiscal/drc-einvoice";

const sample: EinvoicePayload = {
  propertyId: "prop-1",
  fiscalDocId: "fisc-1",
  docKind: "invoice",
  docNo: "INV-2026-0001",
  issuedAt: "2026-08-01T12:00:00Z",
  buyerName: "Test Guest",
  buyerTaxId: null,
  lines: [{ description: "Room", qty: 1, amountBtn: 1000, gstBtn: 70 }],
  totalBtn: 1070,
  gstBtn: 70,
};

describe("StubBhutanEinvoiceClient", () => {
  it("rejects incomplete payloads", async () => {
    const client = new StubBhutanEinvoiceClient();
    const result = await client.submit({ ...sample, docNo: "" });
    assert.equal(result.ok, false);
  });

  it("returns not_configured when live flag off", async () => {
    const prev = process.env.BHUTAN_EINVOICE_LIVE;
    delete process.env.BHUTAN_EINVOICE_LIVE;
    const client = new StubBhutanEinvoiceClient();
    const result = await client.submit(sample);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.status, "not_configured");
    if (prev != null) process.env.BHUTAN_EINVOICE_LIVE = prev;
  });
});
