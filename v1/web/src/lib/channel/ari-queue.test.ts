import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Pure helpers mirrored from Channel mapping checklist / ARI payload rules.
 * Keep in sync with ChannelForms checklist + ari-queue stop_sell logic.
 */

function mappingReady(args: {
  apiReady: boolean;
  hasExternalProperty: boolean;
  connectionStatus: string;
  mappedCount: number;
}): boolean {
  return (
    args.apiReady &&
    args.hasExternalProperty &&
    ["staging", "live"].includes(args.connectionStatus) &&
    args.mappedCount > 0
  );
}

function stopSellFromRemaining(remaining: number): boolean {
  return remaining <= 0;
}

describe("channel Wave 1 helpers", () => {
  it("flush readiness requires api, property id, staging/live, and maps", () => {
    assert.equal(
      mappingReady({
        apiReady: true,
        hasExternalProperty: true,
        connectionStatus: "staging",
        mappedCount: 2,
      }),
      true,
    );
    assert.equal(
      mappingReady({
        apiReady: true,
        hasExternalProperty: true,
        connectionStatus: "mapping",
        mappedCount: 2,
      }),
      false,
    );
    assert.equal(
      mappingReady({
        apiReady: false,
        hasExternalProperty: true,
        connectionStatus: "live",
        mappedCount: 1,
      }),
      false,
    );
  });

  it("stop_sell when remaining availability is zero", () => {
    assert.equal(stopSellFromRemaining(0), true);
    assert.equal(stopSellFromRemaining(3), false);
  });
});
