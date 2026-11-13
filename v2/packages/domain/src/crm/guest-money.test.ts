import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  guestCrmMatchesQuery,
  guestCrmSearchHaystack,
  stayOverlapsRange,
  staysToCsv,
  sumGuestStayMoney,
  type GuestStayMoneyInput,
} from "./guest-money.ts";

const sample: GuestStayMoneyInput[] = [
  {
    checkIn: "2026-10-05",
    checkOut: "2026-10-07",
    charged: 10666.67,
    paid: 10666.67,
    balance: 0,
    guestName: "Ref 02089",
    confirmationNo: "PS-2026-00071",
    roomNumber: "206",
    status: "checked_out",
    agencyName: "SOULTRIPS",
  },
  {
    checkIn: "2026-11-09",
    checkOut: "2026-11-11",
    charged: 22400,
    paid: 0,
    balance: 22400,
    guestName: "Ref 02016",
    confirmationNo: "PSBK-2026-00091",
    roomNumber: "503",
    status: "confirmed",
    companions: [{ name: "Guide Tshering" }],
    agencyName: "SOULTRIPS",
  },
];

describe("guest-money CRM rollups", () => {
  it("sums charged / paid / unpaid", () => {
    const t = sumGuestStayMoney(sample);
    assert.equal(t.charged, 33066.67);
    assert.equal(t.paid, 10666.67);
    assert.equal(t.unpaid, 22400);
    assert.equal(t.stayCount, 2);
  });

  it("filters by date overlap", () => {
    assert.equal(stayOverlapsRange(sample[0]!, "2026-10-01", "2026-10-31"), true);
    assert.equal(stayOverlapsRange(sample[0]!, "2026-11-01", "2026-11-30"), false);
    assert.equal(stayOverlapsRange(sample[1]!, "2026-11-10", "2026-11-10"), true);
  });

  it("searches companion and confirmation inside group dossier", () => {
    const hay = guestCrmSearchHaystack({
      name: "SOULTRIPS",
      passportOrCid: "",
      nationality: "hongkong and australia",
      phone: "",
      stays: sample,
    });
    assert.equal(guestCrmMatchesQuery(hay, "tshering"), true);
    assert.equal(guestCrmMatchesQuery(hay, "02016"), true);
    assert.equal(guestCrmMatchesQuery(hay, "nobody-xyz"), false);
  });

  it("exports CSV with header", () => {
    const csv = staysToCsv(sample);
    assert.match(csv, /^confirmation,guest,/);
    assert.match(csv, /PSBK-2026-00091/);
    assert.match(csv, /22400/);
  });
});
