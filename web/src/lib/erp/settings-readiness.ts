import { rateToPercent } from "@/lib/property-settings";

export type SettingsTabKey =
  | "overview"
  | "identity"
  | "commercial"
  | "policies"
  | "tax"
  | "documents"
  | "rooms"
  | "compliance"
  | "finance-imports"
  | "danger";

export type SettingsCheck = {
  id: string;
  label: string;
  done: boolean;
  tab: SettingsTabKey | "setup";
  /** Verb phrase for setup “Do this next” rows */
  task: string;
};

export type SettingsReadiness = {
  isMature: boolean;
  setupComplete: boolean;
  checks: SettingsCheck[];
  doneCount: number;
  totalCount: number;
  progressPct: number;
  nextTasks: SettingsCheck[];
  healthLine: string;
  regressions: SettingsCheck[];
};

export type SettingsSearchEntry = {
  label: string;
  tab: SettingsTabKey;
  keywords: string[];
  blurb: string;
};

/** Static search index: place names + job phrases → tab. */
export const SETTINGS_SEARCH_INDEX: SettingsSearchEntry[] = [
  {
    label: "Hotel profile",
    tab: "identity",
    keywords: [
      "logo",
      "name",
      "address",
      "phone",
      "email",
      "brand",
      "identity",
      "hotel",
      "legal",
      "tax id",
      "desk",
      "shift",
      "rota",
      "scheduled",
    ],
    blurb: "Name, logo, address, and desk shift restriction",
  },
  {
    label: "Room inventory",
    tab: "rooms",
    keywords: [
      "rooms",
      "inventory",
      "door",
      "category",
      "unit",
      "amenity",
      "par",
      "sellable",
      "guide",
      "driver",
    ],
    blurb: "Categories, door numbers, amenity pars",
  },
  {
    label: "Tax & service",
    tab: "tax",
    keywords: [
      "gst",
      "tax",
      "service charge",
      "sc",
      "night audit",
      "end of day",
      "close time",
    ],
    blurb: "GST, service charge, end-of-day close",
  },
  {
    label: "Meals & defaults",
    tab: "commercial",
    keywords: [
      "meal",
      "breakfast",
      "mplan",
      "extra bed",
      "commission",
      "rates",
      "inclusive",
      "commercial",
    ],
    blurb: "Meal plan Nu, extra bed, rate GST inclusion",
  },
  {
    label: "Policies & Wi‑Fi",
    tab: "policies",
    keywords: [
      "wifi",
      "wi-fi",
      "check-in",
      "check-out",
      "cancel",
      "no-show",
      "house rules",
      "policies",
      "damage",
    ],
    blurb: "Stay times, Wi‑Fi, cancel rules, guest pack",
  },
  {
    label: "Documents",
    tab: "documents",
    keywords: [
      "invoice",
      "receipt",
      "voucher",
      "print",
      "document",
      "design",
      "letterhead",
    ],
    blurb: "Invoice, receipt, and voucher look",
  },
  {
    label: "Compliance",
    tab: "compliance",
    keywords: ["license", "dot", "lease", "vault", "compliance", "permit"],
    blurb: "DOT / lease / vault files",
  },
  {
    label: "Finance imports",
    tab: "finance-imports",
    keywords: [
      "parser",
      "bank",
      "import",
      "statement",
      "gemini",
      "finance import",
    ],
    blurb: "Receipt and bank statement parsers",
  },
  {
    label: "Danger zone",
    tab: "danger",
    keywords: ["wipe", "reset", "danger", "delete data"],
    blurb: "Owner-only destructive reset",
  },
];

export type BuildSettingsReadinessInput = {
  setup_completed_at: string | null;
  logo_public_id: string | null;
  address: string | null;
  phone: string | null;
  tax_id: string | null;
  gst_rate: number;
  sellableRooms: number;
  check_in_time: string | null;
  wifi_name: string | null;
};

function hasText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim());
}

/**
 * Derive dual-mode Settings hub state from property + inventory + policy.
 * Mature = setup complete + logo + sellable rooms + address + mostly green.
 */
export function buildSettingsReadiness(
  input: BuildSettingsReadinessInput,
): SettingsReadiness {
  const checks: SettingsCheck[] = [
    {
      id: "setup",
      label: "Setup wizard finished",
      done: Boolean(input.setup_completed_at),
      tab: "setup",
      task: "Finish the setup wizard",
    },
    {
      id: "logo",
      label: "Hotel logo",
      done: hasText(input.logo_public_id),
      tab: "identity",
      task: "Add your hotel logo",
    },
    {
      id: "address",
      label: "Address",
      done: hasText(input.address),
      tab: "identity",
      task: "Set hotel address",
    },
    {
      id: "phone",
      label: "Phone",
      done: hasText(input.phone),
      tab: "identity",
      task: "Add front desk phone",
    },
    {
      id: "tax_id",
      label: "GST / tax ID",
      done: hasText(input.tax_id),
      tab: "identity",
      task: "Enter GST / tax ID",
    },
    {
      id: "rooms",
      label: "Sellable rooms",
      done: input.sellableRooms > 0,
      tab: "rooms",
      task: "Add sellable guest rooms",
    },
    {
      id: "check_in",
      label: "Check-in time",
      done: hasText(input.check_in_time),
      tab: "policies",
      task: "Set check-in time",
    },
    {
      id: "wifi",
      label: "Wi‑Fi network",
      done: hasText(input.wifi_name),
      tab: "policies",
      task: "Add guest Wi‑Fi name",
    },
  ];

  const doneCount = checks.filter((c) => c.done).length;
  const totalCount = checks.length;
  const progressPct =
    totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

  const setupComplete = Boolean(input.setup_completed_at);
  const coreGreen =
    hasText(input.logo_public_id) &&
    input.sellableRooms > 0 &&
    hasText(input.address);
  // Mature when setup is done, core ops ready, and most checks pass (≥ 6/8).
  const isMature = setupComplete && coreGreen && doneCount >= 6;

  const incomplete = checks.filter((c) => !c.done);
  const nextTasks = incomplete.slice(0, 3);

  // Regressions (mature mode banner): logo, rooms, tax_id, address.
  const regressionIds = new Set(["logo", "rooms", "tax_id", "address"]);
  const regressions = checks.filter(
    (c) => regressionIds.has(c.id) && !c.done,
  );

  const gstPct = rateToPercent(input.gst_rate);
  const healthLine = `Hotel configured · ${input.sellableRooms} sellable room${
    input.sellableRooms === 1 ? "" : "s"
  } · GST ${gstPct}%`;

  return {
    isMature,
    setupComplete,
    checks,
    doneCount,
    totalCount,
    progressPct,
    nextTasks,
    healthLine,
    regressions,
  };
}

export function searchSettingsIndex(query: string): SettingsSearchEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return SETTINGS_SEARCH_INDEX.filter((entry) => {
    if (entry.label.toLowerCase().includes(q)) return true;
    if (entry.blurb.toLowerCase().includes(q)) return true;
    return entry.keywords.some((k) => k.includes(q) || q.includes(k));
  });
}

/** Directory tiles shown on the hub (stable place names). */
export const SETTINGS_DIRECTORY: {
  label: string;
  tab: SettingsTabKey;
  blurb: string;
  group: string;
}[] = [
  {
    label: "Hotel profile",
    tab: "identity",
    blurb: "Name, logo, address, phone",
    group: "Your hotel",
  },
  {
    label: "Inventory",
    tab: "rooms",
    blurb: "Categories and door numbers",
    group: "Rooms",
  },
  {
    label: "Tax & service",
    tab: "tax",
    blurb: "GST, SC, end-of-day close",
    group: "Money",
  },
  {
    label: "Meals & defaults",
    tab: "commercial",
    blurb: "Meal plans and desk defaults",
    group: "Money",
  },
  {
    label: "Policies & Wi‑Fi",
    tab: "policies",
    blurb: "Stay times and house rules",
    group: "Guest stay",
  },
  {
    label: "Documents",
    tab: "documents",
    blurb: "Invoice, receipt, voucher",
    group: "Printouts",
  },
  {
    label: "Compliance",
    tab: "compliance",
    blurb: "Licenses and vault files",
    group: "Licenses",
  },
  {
    label: "Finance imports",
    tab: "finance-imports",
    blurb: "Bank and receipt parsers",
    group: "Advanced",
  },
];
