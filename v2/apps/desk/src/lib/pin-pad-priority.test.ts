import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultPinForDeskRole } from "@hos-v2/domain";
import { FIELD_DEMO_HINTS } from "./field-portal-auth";
import { resolveHotelPinPadTarget } from "./pin-pad-priority";

describe("resolveHotelPinPadTarget", () => {
  const fieldShortcuts = [
    { pin: FIELD_DEMO_HINTS.partner.pin, route: "/partner" },
    { pin: FIELD_DEMO_HINTS.guide.pin, route: "/guide" },
    { pin: FIELD_DEMO_HINTS.driver.pin, route: "/driver" },
  ];

  it("keeps FO default 1111 on desk when hotel gate is active (no partner hijack)", () => {
    const foPin = defaultPinForDeskRole("fo");
    assert.equal(foPin, "1111");
    const target = resolveHotelPinPadTarget({
      hotelGateActive: true,
      pin: foPin!,
      fieldShortcuts,
    });
    assert.equal(target, "desk");
  });

  it("still allows field shortcut matching only when hotel gate is off", () => {
    const target = resolveHotelPinPadTarget({
      hotelGateActive: false,
      pin: "1111",
      fieldShortcuts: [{ pin: "1111", route: "/partner" }],
    });
    assert.deepEqual(target, { kind: "field", route: "/partner" });
  });
});
