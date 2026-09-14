import assert from "node:assert/strict";
import test from "node:test";
import {
  canAdvanceBagStatus,
  isLaundryPhotoId,
  LAUNDRY_BAG_TRANSITIONS,
  LAUNDRY_TRANSITIONS,
  laundryBagScanPath,
  makeLaundryBagPublicCode,
  nextBagStatuses,
  normalizeGuestName,
  validateBagAllocations,
} from "./laundry";

test("guest-name matching is exact after safe normalization", () => {
  assert.equal(normalizeGuestName("  Pema   Choden "), "pema choden");
  assert.equal(normalizeGuestName("PÉMA-Choden"), "pema choden");
  assert.notEqual(normalizeGuestName("Pema"), normalizeGuestName("Pema Choden"));
});

test("laundry status flow blocks skipping chain-of-custody stages", () => {
  assert.deepEqual(LAUNDRY_TRANSITIONS.requested, [
    "received",
    "exception",
  ]);
  assert.equal(LAUNDRY_TRANSITIONS.received.includes("ready"), false);
  assert.equal(LAUNDRY_TRANSITIONS.washing.includes("quality_check"), false);
  assert.equal(LAUNDRY_TRANSITIONS.ready.includes("delivered"), true);
  assert.deepEqual(LAUNDRY_TRANSITIONS.delivered, []);
});

test("bag status follows strict open → in_process → ready → delivered chain", () => {
  assert.deepEqual(nextBagStatuses("open"), ["in_process"]);
  assert.equal(canAdvanceBagStatus("open", "ready"), false);
  assert.equal(canAdvanceBagStatus("delivered", "open"), false);
  assert.equal(LAUNDRY_BAG_TRANSITIONS.delivered.length, 0);
});

test("photo references must stay inside the active property folder", () => {
  const propertyId = "11111111-1111-1111-1111-111111111111";
  assert.equal(
    isLaundryPhotoId(
      `pelbu/laundry/${propertyId}/booking/intake/photo_1`,
      propertyId,
    ),
    true,
  );
  assert.equal(
    isLaundryPhotoId(
      "pelbu/laundry/22222222-2222-2222-2222-222222222222/photo",
      propertyId,
    ),
    false,
  );
  assert.equal(
    isLaundryPhotoId(`pelbu/laundry/${propertyId}/../finance/file`, propertyId),
    false,
  );
});

test("bag allocations cannot exceed garment caps and may require full split", () => {
  const items = [
    { id: "shirt", confirmed_qty: 3, requested_qty: 3 },
    { id: "trouser", confirmed_qty: null, requested_qty: 2 },
  ];
  assert.equal(
    validateBagAllocations(items, [
      { items: [{ orderItemId: "shirt", qty: 2 }] },
      { items: [{ orderItemId: "shirt", qty: 2 }] },
    ]).ok,
    false,
  );
  assert.equal(
    validateBagAllocations(
      items,
      [
        {
          items: [
            { orderItemId: "shirt", qty: 2 },
            { orderItemId: "trouser", qty: 1 },
          ],
        },
        {
          items: [
            { orderItemId: "shirt", qty: 1 },
            { orderItemId: "trouser", qty: 1 },
          ],
        },
      ],
      { requireFull: true },
    ).ok,
    true,
  );
  assert.equal(
    validateBagAllocations(
      items,
      [{ items: [{ orderItemId: "shirt", qty: 3 }] }],
      { requireFull: true },
    ).ok,
    false,
  );
});

test("bag public codes and scan paths stay opaque on the sticker", () => {
  const orderId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  assert.equal(makeLaundryBagPublicCode(orderId, 2), "PLB-AAAAAA2");
  assert.match(
    laundryBagScanPath("bag-id", "raw-token"),
    /^\/staff\/laundry\/bags\/bag-id\?t=/,
  );
  assert.equal(laundryBagScanPath("bag-id", "raw-token").includes("guest"), false);
});
