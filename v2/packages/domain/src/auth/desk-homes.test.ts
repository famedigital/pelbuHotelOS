import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  homeRouteForDeskRole,
  resolveDeskHomeRoute,
  simpleRailItems,
} from "./desk-homes.js";

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

  it("gives Property Admin all modules via * sentinel", () => {
    assert.equal(homeRouteForDeskRole("admin"), "/desk");
    assert.deepEqual([...simpleRailItems("admin")], ["*"]);
    assert.deepEqual([...simpleRailItems("property_admin")], ["*"]);
  });

  it("resolveDeskHomeRoute prefers role, then DEPT code, then DB home", () => {
    assert.equal(
      resolveDeskHomeRoute({ deskRole: "fnb", homeRoute: "/desk" }),
      "/pos",
    );
    assert.equal(
      resolveDeskHomeRoute({
        deskRole: "mystery",
        employeeCode: "DEPT-HK",
        homeRoute: "/desk",
      }),
      "/housekeeping",
    );
    assert.equal(
      resolveDeskHomeRoute({
        deskRole: null,
        homeRoute: "/reservations",
      }),
      "/reservations",
    );
    assert.equal(
      resolveDeskHomeRoute({ deskRole: "owner" }),
      "/owner",
    );
  });
});
