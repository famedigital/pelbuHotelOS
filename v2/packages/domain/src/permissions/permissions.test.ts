import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeActorRole,
  permission,
  roleAllows,
} from "./index.js";

test("normalizeActorRole maps live FO aliases", () => {
  assert.equal(normalizeActorRole("fo"), "fo_agent");
  assert.equal(normalizeActorRole("front_desk"), "fo_agent");
  assert.equal(normalizeActorRole("FO Manager"), "fo_manager");
  assert.equal(normalizeActorRole("owner"), "owner");
  assert.equal(normalizeActorRole("admin"), "admin");
  assert.equal(normalizeActorRole("property_admin"), "admin");
});

test("fo deskRole can void/rebuild package charges", () => {
  assert.equal(roleAllows("fo", permission("finance", "write")), true);
  assert.equal(roleAllows("front_desk", permission("finance", "write")), true);
  assert.equal(roleAllows("fo_agent", permission("finance", "write")), true);
});

test("permissions_agent_has_agency_org_read", () => {
  assert.equal(roleAllows("agent", permission("agency", "org.read")), true);
  assert.equal(roleAllows("partner", permission("agency", "org.read")), true);
  assert.equal(roleAllows("guide", permission("guide", "assignment.read")), true);
  assert.equal(roleAllows("driver", permission("driver", "assignment.read")), true);
  assert.equal(roleAllows("agent", permission("finance", "write")), false);
});
