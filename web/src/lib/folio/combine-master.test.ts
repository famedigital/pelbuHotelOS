import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planCollectionMaster } from "./combine-master";

describe("planCollectionMaster", () => {
  it("promotes the first folio when none is a master", () => {
    const plan = planCollectionMaster([
      { id: "a", folioType: "guest", masterFolioId: null },
      { id: "b", folioType: "guest", masterFolioId: null },
      { id: "c", folioType: "guest", masterFolioId: "other" },
    ]);
    assert.deepEqual(plan, { ok: true, masterId: "a", attachIds: ["b", "c"] });
  });

  it("keeps the existing master and attaches the rest", () => {
    const plan = planCollectionMaster([
      { id: "a", folioType: "guest", masterFolioId: null },
      { id: "m", folioType: "master", masterFolioId: null },
      { id: "b", folioType: "guest", masterFolioId: "m" },
    ]);
    assert.deepEqual(plan, { ok: true, masterId: "m", attachIds: ["a", "b"] });
  });

  it("refuses two different master bills", () => {
    const plan = planCollectionMaster([
      { id: "m1", folioType: "master", masterFolioId: null },
      { id: "m2", folioType: "master", masterFolioId: null },
    ]);
    assert.equal(plan.ok, false);
  });

  it("ignores a master that is already linked under another folio", () => {
    const plan = planCollectionMaster([
      { id: "child", folioType: "master", masterFolioId: "parent" },
      { id: "b", folioType: "guest", masterFolioId: null },
    ]);
    assert.deepEqual(plan, {
      ok: true,
      masterId: "child",
      attachIds: ["b"],
    });
  });

  it("returns one folio with nothing to attach", () => {
    const plan = planCollectionMaster([
      { id: "only", folioType: "guest", masterFolioId: null },
    ]);
    assert.deepEqual(plan, { ok: true, masterId: "only", attachIds: [] });
  });

  it("drops blanks and duplicates", () => {
    const plan = planCollectionMaster([
      { id: " ", folioType: "guest", masterFolioId: null },
      { id: "a", folioType: "guest", masterFolioId: null },
      { id: "a", folioType: "guest", masterFolioId: null },
      { id: "b", folioType: "guest", masterFolioId: null },
    ]);
    assert.deepEqual(plan, { ok: true, masterId: "a", attachIds: ["b"] });
  });

  it("asks for a stay when the list is empty", () => {
    const plan = planCollectionMaster([]);
    assert.equal(plan.ok, false);
  });
});