import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { homeRouteForDeskRole, simpleRailItems } from "./desk-homes.js";

describe("desk homes", () => {
  it("routes FO and F&B to dept homes", () => {
    assert.equal(homeRouteForDeskRole("fo_agent"), "/desk");
    assert.equal(homeRouteForDeskRole("cashier"), "/pos");
    assert.equal(homeRouteForDeskRole("chef"), "/kds");
    assert.equal(homeRouteForDeskRole("reservations"), "/reservations");
    assert.equal(homeRouteForDeskRole("hk_supervisor"), "/housekeeping");
    assert.equal(homeRouteForDeskRole("gm"), "/owner");
    assert.equal(homeRouteForDeskRole("night_auditor"), "/night-audit");
  });

  it("keeps Simple rail short for FO and waiter", () => {
    assert.deepEqual([...simpleRailItems("fo_agent")], ["desk", "stayview", "guests", "print"]);
    assert.deepEqual([...simpleRailItems("cashier")], ["pos"]);
    assert.ok(simpleRailItems("fo_manager").includes("night-audit"));
  });
});
