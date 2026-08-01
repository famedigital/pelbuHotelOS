import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertDeskProperty } from "./property-guard";

describe("assertDeskProperty", () => {
  it("passes when ids match", () => {
    assert.doesNotThrow(() =>
      assertDeskProperty("prop-a", "prop-a", "Folio"),
    );
  });

  it("passes when ids match after trim", () => {
    assert.doesNotThrow(() =>
      assertDeskProperty(" prop-a ", "prop-a", "Booking"),
    );
  });

  it("throws on mismatch", () => {
    assert.throws(
      () => assertDeskProperty("prop-a", "prop-b", "Folio"),
      /Folio is not in the active property/,
    );
  });

  it("throws when row property missing", () => {
    assert.throws(
      () => assertDeskProperty("prop-a", null, "Folio"),
      /not in the active property/,
    );
  });

  it("throws when row property empty", () => {
    assert.throws(
      () => assertDeskProperty("prop-a", "  ", "Payment"),
      /Payment is not in the active property/,
    );
  });

  it("throws when active property unresolved", () => {
    assert.throws(
      () => assertDeskProperty("", "prop-a", "Order"),
      /Active property is not resolved/,
    );
    assert.throws(
      () => assertDeskProperty("   ", "prop-a", "Order"),
      /Active property is not resolved/,
    );
  });

  it("blocks cross-property id loads used by money paths", () => {
    const active = "olakha";
    const foreignRows = [
      { label: "Folio", property_id: "seven-suites" },
      { label: "Booking", property_id: "btcl-hq" },
      { label: "Laundry order", property_id: "other" },
      { label: "Bank transaction", property_id: "foreign" },
      { label: "Journal", property_id: "x" },
    ];
    for (const row of foreignRows) {
      assert.throws(
        () => assertDeskProperty(active, row.property_id, row.label),
        new RegExp(`${row.label} is not in the active property`),
      );
    }
  });
});
