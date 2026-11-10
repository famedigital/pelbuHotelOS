/**
 * H-iso + ACL smoke — run: pnpm --dir v2/apps/api exec tsx scripts/hermes-isolation-check.mts
 */
import { store } from "../src/platform/memory-store.js";
import { canHermes } from "../src/modules/hermes/hermes-acl.js";
import {
  agentHasActiveMou,
  hermesSearchGuests,
  hermesTodaySummary,
} from "../src/modules/hermes/hermes-queries.js";

const PROP_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROP_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

store.bookings.length = 0;
store.mouLinks.length = 0;
store.ensureDemoProperty(PROP_A);
store.ensureDemoProperty(PROP_B);

store.bookings.push(
  {
    id: "baaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    propertyId: PROP_A,
    confirmationNo: "A-1",
    status: "checked_in",
    guestId: null,
    guestName: "Alpha Secret Guest",
    groupId: null,
    checkIn: new Date().toISOString().slice(0, 10),
    checkOut: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    source: "walkin",
    lines: [],
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    propertyId: PROP_B,
    confirmationNo: "B-1",
    status: "checked_in",
    guestId: null,
    guestName: "Beta Secret Guest",
    groupId: null,
    checkIn: new Date().toISOString().slice(0, 10),
    checkOut: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    source: "walkin",
    lines: [],
  },
);

const a = hermesSearchGuests(PROP_A, "Secret");
const b = hermesSearchGuests(PROP_B, "Secret");
if (!a.includes("Alpha Secret Guest") || a.includes("Beta Secret Guest")) {
  throw new Error("H-iso search leak A");
}
if (!b.includes("Beta Secret Guest") || b.includes("Alpha Secret Guest")) {
  throw new Error("H-iso search leak B");
}
const today = hermesTodaySummary(PROP_A);
if (today.includes("Beta Secret Guest")) throw new Error("H-iso today leak");

store.mouLinks.push({
  id: "m1",
  propertyId: PROP_A,
  agentId: "ag-yap",
  status: "active",
});
if (!agentHasActiveMou("ag-yap", PROP_A) || agentHasActiveMou("ag-yap", PROP_B)) {
  throw new Error("MoU gate failed");
}
if (canHermes("hk", "hk_clean", { staffLinked: false })) {
  throw new Error("ACL unlinked mutate should deny");
}
if (!canHermes("agent", "agent_inventory")) {
  throw new Error("ACL agent inventory should allow");
}

console.log("hermes-isolation-check: OK");
