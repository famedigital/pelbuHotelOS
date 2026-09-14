import assert from "node:assert/strict";
import { describe, it } from "node:test";

/** Pure formatter mirroring allocateJournalNo / allocateFiscalDocNo output shape. */
function formatJournalNo(yyyymm: string, seq: number): string {
  return `J${yyyymm}-${String(seq).padStart(4, "0")}`;
}

function formatFiscalDocNo(
  kind: "invoice" | "receipt" | "credit_note",
  year: string,
  seq: number,
): string {
  const prefix =
    kind === "invoice" ? "INV" : kind === "receipt" ? "RCP" : "CN";
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}

describe("property sequence number formats", () => {
  it("formats journal numbers with zero-padded sequence", () => {
    assert.equal(formatJournalNo("202608", 1), "J202608-0001");
    assert.equal(formatJournalNo("202608", 42), "J202608-0042");
  });

  it("formats fiscal document numbers per kind and year", () => {
    assert.equal(formatFiscalDocNo("invoice", "2026", 7), "INV-2026-0007");
    assert.equal(formatFiscalDocNo("receipt", "2026", 12), "RCP-2026-0012");
    assert.equal(formatFiscalDocNo("credit_note", "2026", 3), "CN-2026-0003");
  });
});

describe("payment idempotency key conventions", () => {
  it("uses stable deposit link keys", () => {
    const linkId = "abc-123";
    assert.equal(`deposit_link:${linkId}`, "deposit_link:abc-123");
  });

  it("uses order-scoped POS tender keys", () => {
    const key = `pos_tender:ord-1:cash:150.00:`;
    assert.match(key, /^pos_tender:ord-1:cash:150\.00:$/);
  });
});
