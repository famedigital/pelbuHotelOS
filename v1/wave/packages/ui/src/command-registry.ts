export type CommandKind =
  | "navigate"
  | "open_stay"
  | "fast_book"
  | "copilot"
  | "action";

export type DeskCommand = {
  id: string;
  title: string;
  keywords: string[];
  kind: CommandKind;
  path?: string;
  hint?: string;
};

export const DESK_COMMANDS: DeskCommand[] = [
  {
    id: "nav-desk",
    title: "Day board",
    keywords: ["desk", "day", "arrivals", "departures"],
    kind: "navigate",
    path: "/desk",
  },
  {
    id: "nav-reservations",
    title: "Reservations hub",
    keywords: ["reservations", "booking", "list", "search"],
    kind: "navigate",
    path: "/reservations",
  },
  {
    id: "cmd-fast-book",
    title: "Fast Book",
    keywords: ["fast", "book", "new", "create", "reserve"],
    kind: "fast_book",
    path: "/reservations?fast=1",
    hint: "Create reservation",
  },
  {
    id: "nav-stayview",
    title: "StayView rack",
    keywords: ["stayview", "calendar", "rack", "rooms"],
    kind: "navigate",
    path: "/stayview",
  },
  {
    id: "nav-guests",
    title: "Guests CRM",
    keywords: ["guest", "crm", "dossier"],
    kind: "navigate",
    path: "/guests",
  },
  {
    id: "nav-groups",
    title: "Groups / parties",
    keywords: ["group", "party", "master bill"],
    kind: "navigate",
    path: "/groups",
  },
  {
    id: "nav-pos",
    title: "Restaurant POS",
    keywords: ["pos", "food", "fnb", "menu"],
    kind: "navigate",
    path: "/pos",
  },
  {
    id: "nav-kds",
    title: "Kitchen display",
    keywords: ["kds", "kot", "kitchen"],
    kind: "navigate",
    path: "/kds",
  },
  {
    id: "nav-agents",
    title: "B2B Agents",
    keywords: ["agent", "b2b", "voucher", "tcb"],
    kind: "navigate",
    path: "/agents",
  },
  {
    id: "nav-channel",
    title: "Channel / OTA",
    keywords: ["channel", "ota", "channex", "ari"],
    kind: "navigate",
    path: "/channel",
  },
  {
    id: "nav-rates",
    title: "Rate plans",
    keywords: ["rate", "season", "plan", "allotment"],
    kind: "navigate",
    path: "/rates",
  },
  {
    id: "nav-finance",
    title: "Finance hub",
    keywords: ["finance", "expense", "gst", "rrco"],
    kind: "navigate",
    path: "/finance",
  },
  {
    id: "nav-inventory",
    title: "Inventory & POs",
    keywords: ["inventory", "purchase", "po", "stock"],
    kind: "navigate",
    path: "/purchases",
  },
  {
    id: "nav-hr",
    title: "HR & rota",
    keywords: ["hr", "staff", "rota", "payroll", "leave"],
    kind: "navigate",
    path: "/hr",
  },
  {
    id: "nav-hk",
    title: "Housekeeping",
    keywords: ["hk", "housekeeping", "dirty", "clean"],
    kind: "navigate",
    path: "/housekeeping",
  },
  {
    id: "nav-laundry",
    title: "Laundry desk",
    keywords: ["laundry"],
    kind: "navigate",
    path: "/laundry",
  },
  {
    id: "nav-loyalty",
    title: "Loyalty",
    keywords: ["loyalty", "points", "member"],
    kind: "navigate",
    path: "/loyalty",
  },
  {
    id: "nav-compliance",
    title: "Compliance",
    keywords: ["compliance", "isr", "dot", "training"],
    kind: "navigate",
    path: "/compliance",
  },
  {
    id: "nav-audit",
    title: "Night audit",
    keywords: ["night", "audit", "close"],
    kind: "navigate",
    path: "/night-audit",
  },
  {
    id: "nav-reports",
    title: "Reports studio",
    keywords: ["report", "print", "fiscal"],
    kind: "navigate",
    path: "/reports",
  },
  {
    id: "nav-settings",
    title: "Property settings",
    keywords: ["settings", "pin", "ai", "byok"],
    kind: "navigate",
    path: "/settings",
  },
  {
    id: "nav-owner",
    title: "Owner pulse",
    keywords: ["owner", "pulse", "mrr"],
    kind: "navigate",
    path: "/owner",
  },
  {
    id: "cmd-copilot",
    title: "Ask Copilot (Gemini BYOK)",
    keywords: ["ask", "ai", "gemini", "copilot"],
    kind: "copilot",
    hint: "Draft actions — Confirm still posts money",
  },
];

export function matchDeskCommands(query: string, limit = 12): DeskCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return DESK_COMMANDS.slice(0, limit);

  const code = q.match(/\b(ps|inv|bk)[- ]?\d{2,4}[- ]?\d{3,6}\b/i);
  const scored = DESK_COMMANDS.map((cmd) => {
    let score = 0;
    if (cmd.title.toLowerCase().includes(q)) score += 10;
    for (const kw of cmd.keywords) {
      if (kw.includes(q) || q.includes(kw)) score += 5;
    }
    return { cmd, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.cmd);

  if (code) {
    const openStay: DeskCommand = {
      id: `open-${code[0]}`,
      title: `Open stay ${code[0].toUpperCase()}`,
      keywords: ["stay", code[0]],
      kind: "open_stay",
      path: `/reservations?q=${encodeURIComponent(code[0].toUpperCase())}`,
      hint: "Jump to confirmation",
    };
    return [openStay, ...scored].slice(0, limit);
  }
  return scored.slice(0, limit);
}
