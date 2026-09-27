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

test("buildRatePickupOptions: no agent → local, agent and special disabled, nc", () => {
  const opts = buildRatePickupOptions(null);
  assert.deepEqual(
    opts.map((o) => o.value),
    ["public", "agent", "special", "nc"],
  );
  assert.equal(opts.find((o) => o.value === "public")?.label, "Local");
  assert.equal(opts.find((o) => o.value === "agent")?.disabled, true);
  assert.equal(opts.find((o) => o.value === "special")?.disabled, true);
});

test("buildRatePickupOptions: generic agent → Agent enabled", () => {
  const opts = buildRatePickupOptions({
    company_name: "Jaigaon Tours",
    rate_tier: "agents",
  });
  assert.equal(opts.find((o) => o.value === "agent")?.disabled, false);
  assert.equal(opts.find((o) => o.value === "special")?.disabled, true);
  assert.match(opts.find((o) => o.value === "agent")?.label ?? "", /Jaigaon/);
});

test("buildRatePickupOptions: mou agent → Special enabled", () => {
  const opts = buildRatePickupOptions({
    company_name: "MOU Partner",
    rate_tier: "mou_agents",
  });
  assert.equal(opts.find((o) => o.value === "special")?.disabled, false);
  assert.match(opts.find((o) => o.value === "special")?.label ?? "", /MOU/);
  assert.equal(opts.find((o) => o.value === "agent")?.disabled, true);
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
