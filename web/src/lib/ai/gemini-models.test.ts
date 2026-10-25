import assert from "node:assert/strict";
import test from "node:test";

import { deskGeminiModels, liveGeminiModel } from "./gemini-models";

test("desk chat skips retired Gemini models and calls 3.8 flash first", () => {
  assert.deepEqual(deskGeminiModels("gemini-2.0-flash"), [
    "gemini-3.8-flash",
    "gemini-2.5-flash",
  ]);
  assert.deepEqual(deskGeminiModels("gemini-2.5-flash-lite"), [
    "gemini-3.8-flash",
    "gemini-2.5-flash",
  ]);
  assert.equal(liveGeminiModel(null), "gemini-3.8-flash");
  assert.equal(liveGeminiModel(""), "gemini-3.8-flash");
});

test("a live saved model stays first, with one fallback", () => {
  assert.deepEqual(deskGeminiModels("gemini-2.5-flash"), [
    "gemini-2.5-flash",
    "gemini-3.8-flash",
  ]);
  assert.deepEqual(deskGeminiModels("gemini-3.8-flash"), [
    "gemini-3.8-flash",
    "gemini-2.5-flash",
  ]);
});
