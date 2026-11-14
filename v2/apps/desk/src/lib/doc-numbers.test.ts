import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canonicalHotelInitial,
  hotelInitialFromName,
  rewriteDocHotelInitial,
} from "./doc-numbers.ts";

describe("doc-numbers hotel initial", () => {
  it("derives Demo Hotel → DH", () => {
    assert.equal(hotelInitialFromName("Demo Hotel"), "DH");
  });

  it("forces Pelbu Suites → PS (not PSO)", () => {
    assert.equal(canonicalHotelInitial("Pelbu Suites Olakha"), "PS");
    assert.equal(canonicalHotelInitial("Pelbu Suite"), "PS");
  });

  it("rewrites DH folio/invoice to PS keeping serial", () => {
    assert.equal(rewriteDocHotelInitial("DHFN00121", "DH", "PS"), "PSFN00121");
    assert.equal(rewriteDocHotelInitial("DHINV00121", "DH", "PS"), "PSINV00121");
    assert.equal(rewriteDocHotelInitial("DHPSBN01041", "DH", "PS"), "PSPSBN01041");
  });

  it("leaves unrelated docs alone", () => {
    assert.equal(rewriteDocHotelInitial("FOL-XLS-abc", "DH", "PS"), "FOL-XLS-abc");
    assert.equal(rewriteDocHotelInitial("PSFN00121", "DH", "PS"), "PSFN00121");
  });
});

describe("displayHotelDocNo", () => {
  it("rewrites leftover DH folio when settings target is PS", async () => {
    const { useSettingsStore } = await import("./settings-store.ts");
    const { displayHotelDocNo } = await import("./doc-numbers.ts");
    useSettingsStore.setState({
      hotelName: "Pelbu Suites Olakha",
      hotelInitial: "PS",
      invPrefix: "PSINV",
      psbnPrefix: "PSPSBN",
    });
    assert.equal(displayHotelDocNo("DHFN00121"), "PSFN00121");
    assert.equal(displayHotelDocNo("DHINV00881"), "PSINV00881");
    assert.equal(displayHotelDocNo("PSFN00121"), "PSFN00121");
  });
});
