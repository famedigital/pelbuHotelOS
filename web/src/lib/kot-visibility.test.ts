import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isKitchenBoardVisible,
  isPosBoardVisible,
  isPublicOrderOutlet,
} from "./kot-visibility";

const base = {
  order_source: "desk",
  delivery_type: "dine_in",
  confirmed_at: null as string | null,
  payment_recorded_at: null as string | null,
  settled_at: null as string | null,
  posted_to_folio_at: null as string | null,
  kot_status: "new",
  is_parked: false,
  voided_at: null as string | null,
};

describe("isKitchenBoardVisible", () => {
  it("shows desk tickets with cook status", () => {
    assert.equal(
      isKitchenBoardVisible({ ...base, order_source: "desk" }),
      true,
    );
  });

  it("hides parked and served", () => {
    assert.equal(isKitchenBoardVisible({ ...base, is_parked: true }), false);
    assert.equal(
      isKitchenBoardVisible({ ...base, kot_status: "served" }),
      false,
    );
  });

  it("hides unpaid public pickup/taxi", () => {
    assert.equal(
      isKitchenBoardVisible({
        ...base,
        order_source: "public",
        delivery_type: "pickup",
      }),
      false,
    );
  });

  it("shows public after confirm + payment", () => {
    assert.equal(
      isKitchenBoardVisible({
        ...base,
        order_source: "public",
        delivery_type: "pickup",
        confirmed_at: "2026-08-10T00:00:00Z",
        payment_recorded_at: "2026-08-10T00:01:00Z",
      }),
      true,
    );
  });

  it("shows public room even when settled without confirm flags", () => {
    assert.equal(
      isKitchenBoardVisible({
        ...base,
        order_source: "public",
        delivery_type: "room",
        settled_at: "2026-08-10T00:00:00Z",
        posted_to_folio_at: "2026-08-10T00:00:00Z",
        confirmed_at: null,
        payment_recorded_at: null,
      }),
      true,
    );
  });
});

describe("isPosBoardVisible", () => {
  it("includes settled public room while cooking", () => {
    assert.equal(
      isPosBoardVisible({
        ...base,
        order_source: "public",
        delivery_type: "room",
        settled_at: "2026-08-10T00:00:00Z",
        posted_to_folio_at: "2026-08-10T00:00:00Z",
        kot_status: "preparing",
      }),
      true,
    );
  });

  it("excludes fully done served+settled", () => {
    assert.equal(
      isPosBoardVisible({
        ...base,
        settled_at: "2026-08-10T00:00:00Z",
        kot_status: "served",
      }),
      false,
    );
  });
});

describe("isPublicOrderOutlet", () => {
  it("allows cafe/pastry/restaurant only", () => {
    assert.equal(isPublicOrderOutlet("cafe"), true);
    assert.equal(isPublicOrderOutlet("bar"), false);
  });
});
