import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  folioNoFromConfirmation,
  folioPrintFileName,
  formatHotelDocNo,
  hotelDocPrefix,
  looksLikeHotelDocQuery,
  paperDocNo,
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

  it("gives room, food, and the master bill different numbers from one folio", () => {
    assert.equal(paperDocNo("PSFN-2026-00006", "room"), "PSRM-2026-00006");
    assert.equal(paperDocNo("PSFN-2026-00006", "fnb"), "PSFF-2026-00006");
    assert.equal(paperDocNo("PSFN-2026-00006", "master"), "PSBN-2026-00006");
    assert.equal(
      folioPrintFileName({
        bill: "room",
        folioNo: "PSFN-2026-00006",
        agentName: "Medieval Bhutan",
        guestName: "Mee ok kim",
      }),
      "PSRM-2026-00006 Medieval Bhutan Mee ok kim",
    );
    assert.equal(
      folioPrintFileName({
        pack: true,
        bill: "room",
        folioNo: "PSFN-2026-00006",
        agentName: "Medieval Bhutan",
        guestName: "Mee ok kim",
        groupName: "Medieval Group",
      }),
      "PSBN-2026-00006 Medieval Bhutan Medieval Group",
    );
  });

  it("still recognizes older PS and INV numbers", () => {
    assert.equal(looksLikeHotelDocQuery("PS-2026-00288"), true);
    assert.equal(looksLikeHotelDocQuery("PSFN-2026-00160"), true);
    assert.equal(looksLikeHotelDocQuery("PSRM-2026-00006"), true);
    assert.equal(looksLikeHotelDocQuery("PSFF-2026-00006"), true);
    assert.equal(looksLikeHotelDocQuery("INV-2026-0007"), true);
    assert.equal(looksLikeHotelDocQuery("PelbuFN102"), true);
    assert.equal(looksLikeHotelDocQuery("hello"), false);
  });
});
