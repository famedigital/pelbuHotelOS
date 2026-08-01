import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildEdgeJournalLines,
  proveEdgeJournals,
} from "@/lib/accounting/journal-proof";
import { assertBalancedLines } from "@/lib/accounting/balance";

describe("edge journal proof", () => {
  it("proves all edge shapes balance", () => {
    const kinds = proveEdgeJournals(2500.5);
    assert.equal(kinds.length, 5);
  });

  it("rejects zero amount", () => {
    assert.throws(() => buildEdgeJournalLines("folio_charge", 0));
  });

  it("each line is debit XOR credit", () => {
    const lines = buildEdgeJournalLines("comp", 100);
    assertBalancedLines(lines);
    assert.equal(lines.every((l) => (l.debitBtn > 0) !== (l.creditBtn > 0)), true);
  });
});
