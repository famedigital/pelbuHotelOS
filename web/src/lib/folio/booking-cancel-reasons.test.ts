import assert from "node:assert/strict";
import test from "node:test";
import {
  formatBookingCancelReason,
  isBookingCancelReasonCode,
} from "./booking-cancel-reasons";

test("isBookingCancelReasonCode", () => {
  assert.equal(isBookingCancelReasonCode("guest_cancelled"), true);
  assert.equal(isBookingCancelReasonCode("desk_cancel"), false);
});

test("formatBookingCancelReason joins label and detail", () => {
  assert.equal(
    formatBookingCancelReason("duplicate"),
    "Duplicate booking",
  );
  assert.equal(
    formatBookingCancelReason("guest_cancelled", "flight cancelled"),
    "Guest cancelled · flight cancelled",
  );
  assert.equal(
    formatBookingCancelReason("other", "test"),
    "Other · test",
  );
});
