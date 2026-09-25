import assert from "node:assert/strict";
import test from "node:test";
import {
  agentHasSpecialTier,
  buildRatePickupOptions,
  coerceRatePickup,
  resolveRatePickup,
} from "./desk-book-rate-pickup";

test("agentHasSpecialTier treats mou as special", () => {
  assert.equal(agentHasSpecialTier("agents"), false);
  assert.equal(agentHasSpecialTier("mou_agents"), true);
  assert.equal(agentHasSpecialTier(null), false);
});

test("buildRatePickupOptions: no agent → public personal nc custom", () => {
  const opts = buildRatePickupOptions(null);
  assert.deepEqual(
    opts.map((o) => o.value),
    ["public", "personal", "nc", "custom"],
  );
});

test("buildRatePickupOptions: generic agent → Agent label", () => {
  const opts = buildRatePickupOptions({
    company_name: "Jaigaon Tours",
    rate_tier: "agents",
  });
  assert.ok(opts.some((o) => o.value === "agent"));
  assert.ok(!opts.some((o) => o.value === "special"));
});

test("buildRatePickupOptions: mou agent → Special label", () => {
  const opts = buildRatePickupOptions({
    company_name: "MOU Partner",
    rate_tier: "mou_agents",
  });
  assert.ok(opts.some((o) => o.value === "special" && o.label.includes("MOU")));
  assert.ok(!opts.some((o) => o.value === "agent"));
});

test("resolveRatePickup personal uses sub-tier", () => {
  const r = resolveRatePickup({
    pickup: "personal",
    personalSub: "family",
    agent: null,
  });
  assert.equal(r.rateTier, "family");
  assert.equal(r.guestRateKind, "rack");
});

test("resolveRatePickup nc is comp", () => {
  const r = resolveRatePickup({
    pickup: "nc",
    personalSub: "friends",
    agent: null,
  });
  assert.equal(r.guestRateKind, "comp");
  assert.equal(r.rateTier, null);
});

test("coerceRatePickup drops agent when cleared", () => {
  assert.equal(coerceRatePickup("agent", null), "public");
  assert.equal(
    coerceRatePickup("agent", {
      company_name: "X",
      rate_tier: "mou_agents",
    }),
    "special",
  );
});
