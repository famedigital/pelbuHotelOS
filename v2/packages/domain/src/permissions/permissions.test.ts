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
});

test("fo deskRole can void/rebuild package charges", () => {
  assert.equal(roleAllows("fo", permission("finance", "write")), true);
  assert.equal(roleAllows("front_desk", permission("finance", "write")), true);
  assert.equal(roleAllows("fo_agent", permission("finance", "write")), true);
});
