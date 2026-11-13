import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  agencyInitialsForStay,
  agentCodeFromNotes,
  deriveAgencyInitials,
  stayDisplayGuest,
  stayGroupColor,
} from "./agency-initials.ts";

describe("deriveAgencyInitials", () => {
  it("maps Soul Trips → ST", () => {
    assert.equal(deriveAgencyInitials("Soul Trips"), "ST");
    assert.equal(deriveAgencyInitials("Soultrips"), "ST");
    assert.equal(deriveAgencyInitials("SOULTRIPS"), "ST");
  });

  it("skips Tours / Travel noise words", () => {
    assert.equal(deriveAgencyInitials("AD Tours"), "AD");
    assert.equal(deriveAgencyInitials("Yangphel Adventure Travel"), "YAP");
  });

  it("keeps short codes", () => {
    assert.equal(deriveAgencyInitials("ST"), "ST");
    assert.equal(deriveAgencyInitials("YAP"), "YAP");
  });
});

describe("agentCodeFromNotes", () => {
  it("reads agent ST from import footer", () => {
    assert.equal(
      agentCodeFromNotes(
        "SOULTRIPS\n02111\nImported from Reservation 2026 xlsx · agent ST",
      ),
      "ST",
    );
  });
});

describe("agencyInitialsForStay", () => {
  const agents = [
    { name: "Soul Trips", code: "ST" },
    { name: "Soul", code: "A-EA" },
    { name: "Yangphel Adventure Travel", code: "YAP" },
    { name: "AD Tours", code: "A-EE" },
  ];

  it("prefers note agent tag over synthetic vault code", () => {
    assert.equal(
      agencyInitialsForStay(
        {
          agencyName: "SOULTRIPS",
          notes: "Imported from Reservation 2026 xlsx · agent ST",
        },
        agents,
      ),
      "ST",
    );
  });

  it("does not fuzzy-match Soul → SOULTRIPS as A-EA", () => {
    assert.equal(
      agencyInitialsForStay({ agencyName: "SOULTRIPS" }, agents),
      "ST",
    );
  });

  it("ignores synthetic vault codes for AD Tours", () => {
    assert.equal(
      agencyInitialsForStay({ agencyName: "AD Tours" }, agents),
      "AD",
    );
  });

  it("prefers vault agent code when exact and sane", () => {
    assert.equal(
      agencyInitialsForStay({ agencyName: "Soul Trips" }, [
        { name: "Soul Trips", code: "ST" },
      ]),
      "ST",
    );
  });

  it("falls back to groupName and derivation", () => {
    assert.equal(
      agencyInitialsForStay({ groupName: "AD Tours — FIT" }, []),
      "AD",
    );
  });

  it("returns null when no agency/group", () => {
    assert.equal(agencyInitialsForStay({}, agents), null);
  });
});

describe("stayDisplayGuest", () => {
  it("uses booking ref so same-day Soultrips groups differ", () => {
    assert.equal(
      stayDisplayGuest({
        guestName:
          "SOULTRIPS\n02111\n01 Deluxe Single room\nCheck-in date: 12-Nov-2026",
        notes:
          "SOULTRIPS\n02111\n01 Deluxe Single room\nImported from Reservation 2026 xlsx · agent ST",
        agencyName: "SOULTRIPS",
        confirmationNo: "02111",
      }),
      "02111",
    );
    assert.equal(
      stayDisplayGuest({
        guestName: "SOULTRIPS\n02076\n01 Deluxe Single",
        notes: "SOULTRIPS | 02076 | agent ST",
        agencyName: "SOULTRIPS",
        confirmationNo: "02076",
      }),
      "02076",
    );
  });

  it("keeps a real guest name", () => {
    assert.equal(
      stayDisplayGuest({ guestName: "Karen Meyers", agencyName: "SOULTRIPS" }),
      "Karen Meyers",
    );
  });
});

describe("stayGroupColor", () => {
  it("gives different colors to different Soultrips booking refs", () => {
    const a = stayGroupColor({
      confirmationNo: "02111",
      notes: "SOULTRIPS\n02111",
      agencyName: "SOULTRIPS",
    });
    const b = stayGroupColor({
      confirmationNo: "02076",
      notes: "SOULTRIPS\n02076",
      agencyName: "SOULTRIPS",
    });
    assert.notEqual(a, b);
  });

  it("is stable for the same booking ref", () => {
    const a = stayGroupColor({ confirmationNo: "02111", notes: "02111" });
    const b = stayGroupColor({ confirmationNo: "02111", notes: "02111" });
    assert.equal(a, b);
  });
});
