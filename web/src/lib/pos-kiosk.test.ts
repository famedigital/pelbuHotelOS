import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  posKioskSaleKind,
  resolvePosKioskOutlet,
} from "./pos-kiosk";
import { safeStaffNextPath } from "./safe-staff-next";

describe("POS kiosk outlets", () => {
  it("aliases barista to the cafe till", () => {
    const barista = resolvePosKioskOutlet("barista");
    assert.equal(barista?.outlet, "cafe");
    assert.equal(barista?.label, "Barista");
    assert.equal(posKioskSaleKind("cafe"), "counter");
    assert.equal(posKioskSaleKind("restaurant"), "table");
    assert.equal(posKioskSaleKind("bar"), "counter");
  });

  it("rejects unknown till slugs", () => {
    assert.equal(resolvePosKioskOutlet("spa"), null);
  });
});

describe("safeStaffNextPath POS", () => {
  it("allows POS kiosk return paths", () => {
    assert.equal(safeStaffNextPath("/pos/cafe"), "/pos/cafe");
    assert.equal(safeStaffNextPath("/pos/restaurant"), "/pos/restaurant");
    assert.equal(safeStaffNextPath("https://evil.example"), null);
  });
});
