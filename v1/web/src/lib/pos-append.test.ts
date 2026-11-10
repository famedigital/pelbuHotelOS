import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAddItemsToOpenTicket,
  nextCourseNoForTicket,
} from "./pos-ticket";

describe("canAddItemsToOpenTicket", () => {
  const open = {
    settled_at: null as string | null,
    posted_to_folio_at: null as string | null,
    order_source: "desk",
    payment_recorded_at: null as string | null,
  };

  it("allows unpaid desk tickets", () => {
    assert.equal(canAddItemsToOpenTicket(open), true);
  });

  it("blocks settled and room-posted tickets", () => {
    assert.equal(
      canAddItemsToOpenTicket({ ...open, settled_at: "2026-08-18T10:00:00Z" }),
      false,
    );
    assert.equal(
      canAddItemsToOpenTicket({
        ...open,
        posted_to_folio_at: "2026-08-18T10:00:00Z",
      }),
      false,
    );
  });

  it("blocks paid public orders", () => {
    assert.equal(
      canAddItemsToOpenTicket({
        ...open,
        order_source: "public",
        payment_recorded_at: "2026-08-18T10:00:00Z",
      }),
      false,
    );
  });
});

describe("nextCourseNoForTicket", () => {
  it("starts course 2 after a first send", () => {
    assert.equal(
      nextCourseNoForTicket({ order_items: [{ course_no: 1 }] }),
      2,
    );
  });

  it("bumps from the highest existing course", () => {
    assert.equal(
      nextCourseNoForTicket({
        order_items: [{ course_no: 1 }, { course_no: 2 }, { course_no: 2 }],
      }),
      3,
    );
  });

  it("caps at 12", () => {
    assert.equal(
      nextCourseNoForTicket({ order_items: [{ course_no: 12 }] }),
      12,
    );
  });
});
