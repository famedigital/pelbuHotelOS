import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { projectShareTier } from "./project-share-tier.js";
import type { AgencyTripRecord } from "./types.js";

const FIXTURE_TRIP: AgencyTripRecord = {
  id: "trip-1",
  code: "ST-2026-001",
  clientName: "Tracy Chen",
  paxAdults: 2,
  paxChildren: 0,
  dietaryNotes: "No pork",
  arrivalFlight: "KB400",
  days: [
    {
      dayIndex: 1,
      date: "2026-12-01",
      title: "Paro arrival",
      narrative: "Land and drive to Thimphu",
      overnightDzongkhag: "Thimphu",
    },
  ],
  stays: [
    {
      id: "stay-a",
      propertyId: "prop-pelbu",
      propertyName: "Pelbu Olakha",
      roomTypeName: "Deluxe",
      roomNumbers: ["201"],
      checkIn: "2026-12-01",
      checkOut: "2026-12-03",
      mealPlan: "MAP",
      nightlyNetRateChh: 12_000_00,
    },
    {
      id: "stay-b",
      propertyId: "prop-other",
      propertyName: "Other Hotel",
      roomTypeName: "Standard",
      roomNumbers: ["101"],
      checkIn: "2026-12-03",
      checkOut: "2026-12-05",
      mealPlan: "CP",
      nightlyNetRateChh: 8_000_00,
    },
  ],
  staff: {
    guideName: "Dorji",
    guidePhone: "17111111",
    driverName: "Karma",
    driverPhone: "17222222",
    vehiclePlate: "BP-1-A1234",
  },
  budgetLines: [
    {
      id: "b1",
      kind: "hotel",
      label: "Hotels",
      qty: 1,
      unitChh: 75_000,
      amountChh: 75_000,
      isClientVisible: false,
    },
    {
      id: "b2",
      kind: "sell",
      label: "Package",
      qty: 1,
      unitChh: 150_000,
      amountChh: 150_000,
      isClientVisible: true,
    },
  ],
  clientGrossSellChh: 150_000,
  sdfTotalChh: 40_000,
  passportDocUrls: ["s3://secret/passport.pdf"],
  // unknown keys must not appear on non-agency if someone spreads — projector builds allowlists
};

describe("projectShareTier", () => {
  it("rejects_invalid_tier", () => {
    assert.throws(
      () => projectShareTier(FIXTURE_TRIP, "admin" as "agency"),
      /INVALID_SHARE_TIER/,
    );
  });

  it("agency_includes_margin_and_budget", () => {
    const out = projectShareTier(FIXTURE_TRIP, "agency");
    assert.ok(Array.isArray(out.budgetLines));
    assert.equal((out.budgetLines as unknown[]).length, 2);
    assert.equal(out.clientGrossSellChh, 150_000);
    assert.equal(out.sdfTotalChh, 40_000);
    assert.deepEqual(out.passportDocUrls, ["s3://secret/passport.pdf"]);
    const margin = out.margin as { marginBps: number; marginChh: number };
    assert.equal(margin.marginChh, 75_000);
    assert.equal(margin.marginBps, 5000);
  });

  it("guest_strips_rates_and_phones_and_rooms", () => {
    const out = projectShareTier(FIXTURE_TRIP, "guest");
    assert.equal(out.budgetLines, undefined);
    assert.equal(out.margin, undefined);
    assert.equal(out.clientGrossSellChh, undefined);
    assert.equal(out.passportDocUrls, undefined);
    const stays = out.stays as Array<Record<string, unknown>>;
    assert.equal(stays[0]?.roomNumbers, undefined);
    assert.equal(stays[0]?.nightlyNetRateChh, undefined);
    const staff = out.staff as Record<string, unknown>;
    assert.equal(staff.guidePhone, undefined);
    assert.equal(staff.guideName, "Dorji");
    const days = out.days as Array<Record<string, unknown>>;
    assert.equal(days[0]?.narrative, "Land and drive to Thimphu");
  });

  it("guide_strips_money_keeps_rooms_and_dietary", () => {
    const out = projectShareTier(FIXTURE_TRIP, "guide");
    assert.equal(out.budgetLines, undefined);
    assert.equal(out.margin, undefined);
    assert.equal(out.clientGrossSellChh, undefined);
    assert.equal(out.dietaryNotes, "No pork");
    const stays = out.stays as Array<Record<string, unknown>>;
    assert.deepEqual(stays[0]?.roomNumbers, ["201"]);
    assert.equal(stays[0]?.nightlyNetRateChh, undefined);
    const staff = out.staff as Record<string, unknown>;
    assert.equal(staff.guidePhone, "17111111");
  });

  it("driver_strips_narrative_and_money", () => {
    const out = projectShareTier(FIXTURE_TRIP, "driver");
    assert.equal(out.budgetLines, undefined);
    assert.equal(out.clientName, undefined);
    assert.equal(out.dietaryNotes, undefined);
    const days = out.days as Array<Record<string, unknown>>;
    assert.equal(days[0]?.title, "Paro arrival");
    assert.equal(days[0]?.narrative, undefined);
    const stays = out.stays as Array<Record<string, unknown>>;
    assert.equal(stays[0]?.roomNumbers, undefined);
    assert.equal(stays[0]?.nightlyNetRateChh, undefined);
  });

  it("hotel_hide_rates_default_strips_net", () => {
    const out = projectShareTier(FIXTURE_TRIP, "hotel");
    assert.equal(out.budgetLines, undefined);
    assert.equal(out.margin, undefined);
    assert.equal(out.clientGrossSellChh, undefined);
    assert.equal(out.days, undefined);
    const stays = out.stays as Array<Record<string, unknown>>;
    assert.equal(stays.length, 2);
    assert.equal(stays[0]?.nightlyNetRateChh, undefined);
    assert.deepEqual(stays[0]?.roomNumbers, ["201"]);
  });

  it("hotel_property_filter_drops_other_hotels", () => {
    const out = projectShareTier(FIXTURE_TRIP, "hotel", {
      propertyIdFilter: "prop-pelbu",
      hideRates: true,
    });
    const stays = out.stays as Array<Record<string, unknown>>;
    assert.equal(stays.length, 1);
    assert.equal(stays[0]?.propertyName, "Pelbu Olakha");
  });

  it("strips_passport_for_all_non_agency", () => {
    for (const tier of ["guest", "guide", "driver", "hotel"] as const) {
      const out = projectShareTier(FIXTURE_TRIP, tier);
      assert.equal(out.passportDocUrls, undefined, tier);
    }
  });

  it("unknown_input_keys_not_copied_to_output", () => {
    const dirty = {
      ...FIXTURE_TRIP,
      secretMarginNote: "do not leak",
    } as AgencyTripRecord & { secretMarginNote: string };
    const out = projectShareTier(dirty, "guest");
    assert.equal(
      (out as { secretMarginNote?: string }).secretMarginNote,
      undefined,
    );
  });
});
