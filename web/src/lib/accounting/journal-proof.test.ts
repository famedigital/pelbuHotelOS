import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertReversalNetsToZero,
  buildEdgeJournalLines,
  proveEdgeJournals,
  reverseLines,
} from "./journal-proof";
import { assertBalancedLines } from "./balance";

describe("edge journal proof", () => {
  it("proves all edge shapes balance (inc GST + reverse void)", () => {
    const kinds = proveEdgeJournals(2500.5);
    assert.ok(kinds.length >= 11);
    assert.ok(kinds.includes("folio_charge_gst"));
    assert.ok(kinds.includes("laundry_gst"));
  });

  it("rejects zero amount", () => {
    assert.throws(() => buildEdgeJournalLines("folio_charge", 0));
  });

  it("each line is debit XOR credit", () => {
    const lines = buildEdgeJournalLines("comp", 100);
    assertBalancedLines(lines);
    assert.equal(
      lines.every((l) => (l.debitBtn > 0) !== (l.creditBtn > 0)),
      true,
    );
  });

  it("GST folio charge balances gross = net + gst", () => {
    const lines = buildEdgeJournalLines("folio_charge_gst", 1070, 70);
    assertBalancedLines(lines);
    assert.equal(lines.length, 3);
    const debit = lines.reduce((s, l) => s + l.debitBtn, 0);
    const credit = lines.reduce((s, l) => s + l.creditBtn, 0);
    assert.equal(debit, credit);
    assert.equal(debit, 1070);
  });

  it("void reverse unwinds AR and revenue", () => {
    const charge = buildEdgeJournalLines("folio_charge", 1500);
    const voids = reverseLines(charge);
    assertReversalNetsToZero(charge, voids);
  });

  it("void reverse unwinds GST three-line sale", () => {
    const charge = buildEdgeJournalLines("folio_charge_gst", 1070, 70);
    assertReversalNetsToZero(charge, reverseLines(charge));
  });

  it("detects incomplete reversal", () => {
    const charge = buildEdgeJournalLines("folio_charge", 100);
    const bad = reverseLines(charge).slice(0, 1);
    assert.throws(() => assertReversalNetsToZero(charge, bad));
  });
});
