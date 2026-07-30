import { test } from "node:test";
import assert from "node:assert/strict";
import {
  guideRequired,
  inventoryKindLabel,
  normalizeGuestOrigin,
  sdfRequired,
  validateCheckInDocs,
} from "./checkin-rules";

test("guide required only for international origin", () => {
  assert.equal(guideRequired("international"), true);
  assert.equal(guideRequired("local"), false);
  assert.equal(guideRequired("regional"), false);
});

test("SDF required for international and regional", () => {
  assert.equal(sdfRequired("international"), true);
  assert.equal(sdfRequired("regional"), true);
  assert.equal(sdfRequired("local"), false);
});

test("validateCheckInDocs catches missing guide for international", () => {
  const err = validateCheckInDocs({
    origin: "international",
    guideNumber: "",
    guests: [{ fullName: "Ada", passportOrCid: "P1", sdfRef: "SDF1" }],
    hasDriverBeds: false,
    driverName: null,
  });
  assert.match(err ?? "", /Guide number/);
});

test("local guest can skip SDF and guide", () => {
  const err = validateCheckInDocs({
    origin: "local",
    guideNumber: null,
    guests: [{ fullName: "Tashi", passportOrCid: "CID-1", sdfRef: "" }],
    hasDriverBeds: false,
    driverName: null,
  });
  assert.equal(err, null);
});

test("normalizeGuestOrigin falls back to international", () => {
  assert.equal(normalizeGuestOrigin("weird"), "international");
  assert.equal(normalizeGuestOrigin("local"), "local");
});

test("driver beds require driver name", () => {
  const err = validateCheckInDocs({
    origin: "local",
    guideNumber: null,
    guests: [{ fullName: "Tashi", passportOrCid: "CID-1", sdfRef: "" }],
    hasDriverBeds: true,
    driverName: "",
  });
  assert.match(err ?? "", /Driver name/);
});

test("international SDF missing fails", () => {
  const err = validateCheckInDocs({
    origin: "international",
    guideNumber: "G-9",
    guests: [{ fullName: "Ada", passportOrCid: "P1", sdfRef: "" }],
    hasDriverBeds: false,
    driverName: null,
  });
  assert.match(err ?? "", /SDF/);
});

test("inventory kind labels", () => {
  assert.equal(inventoryKindLabel("guide_comp"), "Guide bed");
  assert.equal(inventoryKindLabel("sellable_guest"), "Guest room");
});
