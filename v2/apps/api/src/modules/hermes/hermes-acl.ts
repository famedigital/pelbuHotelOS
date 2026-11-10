/** Role → capability matrix for Hotel Hermes (property-scoped). */

import type { HermesRole } from "../../platform/memory-store.js";

export type HermesCapability =
  | "query_today"
  | "query_occ"
  | "query_arrivals"
  | "query_search"
  | "hk_clean"
  | "kitchen_covers"
  | "audit_flash"
  | "doc_ocr"
  | "agent_inventory"
  | "agent_book"
  | "agent_change"
  | "print_receive";

const ROLE_CAPS: Record<HermesRole, ReadonlySet<HermesCapability>> = {
  fo: new Set([
    "query_today",
    "query_occ",
    "query_arrivals",
    "query_search",
    "doc_ocr",
    "print_receive",
  ]),
  hk: new Set(["query_today", "query_arrivals", "hk_clean", "print_receive"]),
  kitchen: new Set(["query_today", "kitchen_covers", "print_receive"]),
  manager: new Set([
    "query_today",
    "query_occ",
    "query_arrivals",
    "query_search",
    "hk_clean",
    "kitchen_covers",
    "audit_flash",
    "doc_ocr",
    "print_receive",
  ]),
  gm: new Set([
    "query_today",
    "query_occ",
    "query_arrivals",
    "query_search",
    "hk_clean",
    "kitchen_covers",
    "audit_flash",
    "doc_ocr",
    "print_receive",
  ]),
  agent: new Set([
    "agent_inventory",
    "agent_book",
    "agent_change",
    "query_arrivals",
  ]),
};

/** Unlinked Telegram users in a group: help/status only. */
export function canHermes(
  role: HermesRole | null | undefined,
  cap: HermesCapability,
  opts?: { staffLinked?: boolean },
): boolean {
  if (!role) return false;
  if (role !== "agent" && opts?.staffLinked === false) {
    return false;
  }
  return ROLE_CAPS[role]?.has(cap) ?? false;
}

export function hermesHelpForRole(role: HermesRole): string {
  const lines = [
    "<b>Hotel OS Hermes</b> — 24×7 property support",
    "",
    "/status — paired property + role",
    "/help — this message",
    "/unpair — disconnect this chat",
  ];
  if (canHermes(role, "query_today")) lines.push("/today — arrivals + in-house");
  if (canHermes(role, "query_occ")) lines.push("/occ — occupancy snapshot");
  if (canHermes(role, "query_arrivals")) lines.push("/arrivals — today’s arrivals");
  if (canHermes(role, "query_search")) lines.push("/search &lt;name&gt; — find guest");
  if (canHermes(role, "hk_clean")) lines.push("/clean &lt;room&gt; — mark clean");
  if (canHermes(role, "kitchen_covers")) lines.push("/covers — meal covers");
  if (canHermes(role, "audit_flash")) lines.push("/audit — manager flash");
  if (canHermes(role, "doc_ocr")) {
    lines.push("", "Photo passport/CID/SDF → tap room to attach");
  }
  if (canHermes(role, "agent_inventory")) {
    lines.push(
      "",
      "<b>Agent</b>",
      "/hotel &lt;code&gt; — active MoU hotel",
      "/inventory — sellable by type",
      "/quote &lt;type&gt; &lt;in&gt; &lt;out&gt;",
      "/book … — held reservation",
      "/my — own bookings",
      "/change … — propose desk change",
      "/mou — MoU status",
    );
  }
  return lines.join("\n");
}
