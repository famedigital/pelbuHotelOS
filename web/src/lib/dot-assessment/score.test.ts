import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getCatalog } from "./catalog";
import { computeScoreboard } from "./score";
import type { DotResponse } from "./types";

describe("DOT catalog", () => {
  it("3-star catalog has 324 leaves, 20 gate items, M required 163", () => {
    const c = getCatalog(3);
    assert.equal(c.stats.leafCriteria, 324);
    assert.equal(c.entryGate.length, 20);
    assert.equal(c.sections.length, 12);
    assert.equal(c.scoring.mandatoryRequired, 163);
    const mCaps = c.sections.reduce((n, s) => n + (s.caps.M ?? 0), 0);
    assert.equal(mCaps, 163);
    const mLeaf = c.sections.reduce(
      (n, s) => n + s.criteria.filter((x) => x.kind === "M").length,
      0,
    );
    assert.equal(mLeaf, 163);
    assert.equal(c.stats.mandatoryLeafCount, 163);
  });

  it("4-star catalog has 324 leaves and M required 192", () => {
    const c = getCatalog(4);
    assert.equal(c.stats.leafCriteria, 324);
    assert.equal(c.entryGate.length, 20);
    assert.equal(c.scoring.mandatoryRequired, 192);
    const mCaps = c.sections.reduce((n, s) => n + (s.caps.M ?? 0), 0);
    assert.equal(mCaps, 192);
  });
});

describe("computeScoreboard", () => {
  it("entry gate incomplete blocks ready state", () => {
    const catalog = getCatalog(3);
    const board = computeScoreboard(catalog, []);
    assert.equal(board.entryGatePass, false);
    assert.equal(board.entryGate.pending, 20);
    assert.equal(board.readyForInspection, false);
  });

  it("all entry gates Yes with empty sections still not ready", () => {
    const catalog = getCatalog(3);
    const responses: DotResponse[] = catalog.entryGate.map((g) => ({
      criterionCode: g.code,
      sectionKey: "gate",
      status: "yes",
      scoreM: 1,
      scoreQ: null,
      scoreP: null,
      remarks: null,
    }));
    const board = computeScoreboard(catalog, responses);
    assert.equal(board.entryGatePass, true);
    assert.equal(board.readyForInspection, false);
  });

  it("naSections excludes recreation from progress", () => {
    const catalog = getCatalog(3);
    const withNa = computeScoreboard(catalog, [], ["recreation", "mice"]);
    const full = computeScoreboard(catalog, [], []);
    assert.ok(withNa.totals.totalScorable < full.totals.totalScorable);
    assert.equal(
      withNa.sections.find((s) => s.sectionKey === "recreation")?.na,
      true,
    );
  });

  it("size-threshold M rows count toward leaf mandatory (no sheet-only gap)", () => {
    const catalog = getCatalog(3);
    assert.equal(catalog.stats.mandatoryLeafCount, catalog.scoring.mandatoryRequired);
    const sizeCodes = ["3.1.1", "3.3.1", "3.3.9", "3.4.6", "4.1.1", "11.1.1"];
    for (const code of sizeCodes) {
      let found = false;
      for (const s of catalog.sections) {
        const c = s.criteria.find((x) => x.code === code);
        if (c) {
          assert.equal(c.kind, "M", `${code} should be M`);
          found = true;
          break;
        }
      }
      assert.equal(found, true, `${code} missing`);
    }
    const board = computeScoreboard(catalog, []);
    assert.equal(board.totals.mSheetOnlyGap, 0);
    assert.equal(board.totals.mLeafRequired, 163);
  });
});
