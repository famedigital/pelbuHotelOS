import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  folioNoFromConfirmation,
  formatHotelDocNo,
  hotelDocPrefix,
  looksLikeHotelDocQuery,
} from "./hotel-doc-no";

describe("hotel document numbers", () => {
  it("uses PS and the year", () => {
    assert.equal(hotelDocPrefix("Pelbu Suites"), "PS");
    assert.equal(hotelDocPrefix("Pelbu Suites Olakha"), "PS");
    assert.equal(formatHotelDocNo("PS", "FN", 160, 2026), "PSFN-2026-00160");
    assert.equal(formatHotelDocNo("PS", "BK", 88, 2026), "PSBK-2026-00088");
    assert.equal(formatHotelDocNo("PS", "BN", 41, 2026), "PSBN-2026-00041");
  });

  it("turns the booking code into the folio number", () => {
    assert.equal(folioNoFromConfirmation("PS-2026-00160"), "PSFN-2026-00160");
    assert.equal(folioNoFromConfirmation("PSFN-2026-00160"), "PSFN-2026-00160");
  });

  it("still recognizes older PS and INV numbers", () => {
    assert.equal(looksLikeHotelDocQuery("PS-2026-00288"), true);
    assert.equal(looksLikeHotelDocQuery("PSFN-2026-00160"), true);
    assert.equal(looksLikeHotelDocQuery("INV-2026-0007"), true);
    assert.equal(looksLikeHotelDocQuery("PelbuFN102"), true);
    assert.equal(looksLikeHotelDocQuery("hello"), false);
  });
});
