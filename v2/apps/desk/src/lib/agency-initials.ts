/**
 * Compact agent code for StayView ribbons — e.g. Soul Trips → ST.
 * Prefer known aliases / note tags / sensible vault codes; never trust
 * synthetic vault codes like A-EA from fuzzy name matches.
 */

const SKIP_WORDS = new Set([
  "the",
  "and",
  "of",
  "tours",
  "tour",
  "travel",
  "travels",
  "adventure",
  "adventures",
  "ltd",
  "pvt",
  "private",
  "company",
  "co",
  "bhutan",
  "inc",
  "llc",
  "&",
]);

function normKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Common FO spellings when vault code is not yet linked. */
const KNOWN_ALIASES: Record<string, string> = {
  soultrips: "ST",
  soultrip: "ST",
  soultripsbhutan: "ST",
  adtours: "AD",
  adtourstravels: "AD",
  drukasia: "DA",
  yangphel: "YAP",
  yangpheladventuretravel: "YAP",
  ethometho: "EM",
  journeydmc: "JDMC",
  journeydmcbhutan: "JDMC",
  littlebhutan: "LB",
  yakholidays: "YH",
  walkin: "WIG",
  walkinguest: "WIG",
};

/** Auto-minted / opaque codes we should not show on the rack. */
function isSyntheticAgentCode(code: string): boolean {
  const c = code.trim().toUpperCase();
  if (!c) return true;
  /* A-EA, A-EE, A-1 — common bad seeds */
  if (/^A-[A-Z0-9]{1,3}$/.test(c)) return true;
  if (/^[0-9a-f]{8}$/i.test(c)) return true;
  return false;
}

/** Derive 2–3 letter initials from a free-text agency / tour-op name. */
export function deriveAgencyInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  if (/^[A-Za-z0-9]{2,4}$/.test(trimmed)) return trimmed.toUpperCase();

  const alias = KNOWN_ALIASES[normKey(trimmed)];
  if (alias) return alias;

  const words = trimmed
    .split(/[\s/&._+|–—−-]+/u)
    .map((w) => w.trim())
    .filter((w) => w.length > 0 && /[A-Za-z0-9]/.test(w));
  const significant = words.filter((w) => !SKIP_WORDS.has(w.toLowerCase()));
  const pool = significant.length > 0 ? significant : words;

  if (pool.length === 0) return trimmed.slice(0, 2).toUpperCase();
  if (pool.length === 1) {
    const w = pool[0]!;
    const one = KNOWN_ALIASES[normKey(w)];
    if (one) return one;
    if (w.length <= 3) return w.toUpperCase();
    return (w[0]! + w[1]!).toUpperCase();
  }
  return pool
    .slice(0, 3)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/** Pull `agent ST` / `Alias ST` tags from import notes when present. */
export function agentCodeFromNotes(notes: string | null | undefined): string | null {
  const text = String(notes || "");
  if (!text.trim()) return null;
  const m =
    text.match(/\bagent\s*[:·]?\s*([A-Za-z0-9]{2,6})\b/i) ||
    text.match(/\balias\s*[:·]?\s*([A-Za-z0-9]{2,6})\b/i);
  if (!m?.[1]) return null;
  const code = m[1].toUpperCase();
  if (isSyntheticAgentCode(code)) return null;
  return code;
}

function isAgencyOnlyLabel(value: string): boolean {
  return /^(SOULTRIPS?|SOUL\s*TRIPS?|ST|JDMC|JDMCB|WIG|LB|YH|AD)$/i.test(
    value.trim(),
  );
}

/** Soultrips / TA booking refs in notes (02111, 02076, …). */
function bookingRefFromText(text: string): string | null {
  const labelled =
    text.match(
      /\b(?:SOUL\s*TRIPS?|SOULTRIPS?|conf(?:irmation)?(?:\s*(?:no\.?|number))?|ref(?:erence)?|booking\s*(?:id|code|no\.?)?)\s*[:#]?\s*(0?\d{4,6})\b/i,
    )?.[1] || null;
  if (labelled) return labelled;
  /* Standalone 4–6 digit line typical of rack import dumps */
  const line = text
    .split(/\r?\n|[|·]/)
    .map((l) => l.trim())
    .find((l) => /^0?\d{4,6}$/.test(l));
  return line || null;
}

/**
 * Guest / group line for ribbons beside the agent badge.
 * Same-day Soultrips groups must differ by booking ref or guest — never
 * repeat "SOULTRIPS" when the chip already shows ST.
 */
export function stayDisplayGuest(stay: {
  guestName?: string | null;
  notes?: string | null;
  confirmationNo?: string | null;
  agencyName?: string | null;
  groupName?: string | null;
}): string {
  const raw = String(stay.guestName || "").trim();
  const note = String(stay.notes || "");
  const blob = `${raw}\n${note}`;
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const looksLikeDump =
    lines.length > 1 ||
    /check-?in\s*date|imported from reservation|deluxe\s+(single|double|twin)/i.test(
      raw,
    );

  /* Real person name on the stay — keep it (different groups same day). */
  if (!looksLikeDump && raw && !isAgencyOnlyLabel(raw)) {
    return raw;
  }

  const guestLine =
    blob.match(/guest\s*names?\s*[:：]\s*([^\n|]+)/i)?.[1]?.trim() ||
    blob.match(/group\s*names?\s*[:：]\s*([^\n|]+)/i)?.[1]?.trim() ||
    "";
  if (guestLine && !isAgencyOnlyLabel(guestLine)) {
    return guestLine.replace(/\s+/g, " ").slice(0, 64);
  }

  const group =
    stay.groupName?.trim() && !isAgencyOnlyLabel(stay.groupName)
      ? stay.groupName.trim()
      : "";

  const conf =
    (stay.confirmationNo?.trim() &&
    !/^PS-|^BK-/i.test(stay.confirmationNo.trim())
      ? stay.confirmationNo.trim()
      : null) ||
    bookingRefFromText(blob) ||
    "";

  /* Prefer booking ref so ST 02111 ≠ ST 02076 on the same night. */
  if (group && conf) return `${group} · ${conf}`.slice(0, 48);
  if (conf) return conf;
  if (group) return group.slice(0, 40);

  const agency = stay.agencyName?.trim() || "";
  if (agency && !isAgencyOnlyLabel(agency)) return agency;
  if (lines[0] && !isAgencyOnlyLabel(lines[0]) && lines[0].length <= 40) {
    return lines[0];
  }
  return conf || "Group";
}

export type AgencyCodeHint = {
  name: string;
  code: string;
};

/**
 * Distinct Himalayan palette for same-day multi-group ribbons
 * (e.g. several Soultrips booking refs on one night).
 */
export const STAY_GROUP_PALETTE = [
  "#0D9488", // teal
  "#2563EB", // lapis
  "#D97706", // amber
  "#059669", // emerald
  "#7C3AED", // violet
  "#DC2626", // ruby
  "#0891B2", // cyan
  "#CA8A04", // gold
  "#DB2777", // pink
  "#4F46E5", // indigo
  "#EA580C", // orange
  "#0F766E", // pine
] as const;

function hashHue(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Stable key so ST 02111 ≠ ST 02076 color even without formal groupMeta. */
export function stayColorKey(stay: {
  id?: string | null;
  groupId?: string | null;
  confirmationNo?: string | null;
  notes?: string | null;
  guestName?: string | null;
  agencyName?: string | null;
}): string {
  const blob = `${stay.notes || ""}\n${stay.guestName || ""}`;
  const ref =
    bookingRefFromText(blob) ||
    (stay.confirmationNo?.trim() &&
    !/^PS-|^BK-/i.test(stay.confirmationNo.trim())
      ? stay.confirmationNo.trim()
      : "") ||
    stay.groupId?.trim() ||
    stay.id ||
    stay.agencyName ||
    "stay";
  return String(ref).toLowerCase();
}

/**
 * Ribbon / accent color for a stay group.
 * Prefers explicit groupMeta color when provided; else palette by booking ref.
 */
export function stayGroupColor(
  stay: {
    id?: string | null;
    groupId?: string | null;
    confirmationNo?: string | null;
    notes?: string | null;
    guestName?: string | null;
    agencyName?: string | null;
  },
  metaColor?: string | null,
): string {
  if (metaColor?.trim() && stay.groupId) {
    /* Still re-tint when meta is shared across different booking refs */
    const key = stayColorKey(stay);
    if (key === stay.groupId.toLowerCase()) return metaColor.trim();
  }
  const idx = hashHue(stayColorKey(stay)) % STAY_GROUP_PALETTE.length;
  return STAY_GROUP_PALETTE[idx]!;
}

/**
 * Resolve display initials for a stay: note tag → known alias → exact vault
 * match → derived letters. Skips synthetic vault codes (A-EA).
 */
export function agencyInitialsForStay(
  stay: {
    agencyName?: string | null;
    groupName?: string | null;
    notes?: string | null;
    guestName?: string | null;
  },
  agents: AgencyCodeHint[] = [],
): string | null {
  const fromNotes = agentCodeFromNotes(stay.notes);
  if (fromNotes) return fromNotes;

  const raw =
    stay.agencyName?.trim() ||
    stay.groupName?.trim() ||
    null;
  /* Sometimes agency only appears as first line of the import dump guestName */
  const fromGuest =
    !raw && stay.guestName
      ? stay.guestName
          .split(/\r?\n/)
          .map((l) => l.trim())
          .find((l) => l && !/^\d+$/.test(l) && !/check-?in/i.test(l))
      : null;
  const labelSource = raw || fromGuest || "";
  if (!labelSource) return null;

  const label = labelSource.split(/\s*[–—−|:]\s*/)[0]?.trim() || labelSource;
  const key = normKey(label);
  if (!key) return null;

  const alias = KNOWN_ALIASES[key] || deriveAgencyInitials(label);
  if (alias && KNOWN_ALIASES[key]) return alias;

  const hit = agents.find((a) => {
    const n = normKey(a.name);
    const c = normKey(a.code);
    if (!n && !c) return false;
    /* Exact name or exact code only — no prefix fuzzy (Soul → SOULTRIPS). */
    return n === key || c === key;
  });
  if (hit?.code?.trim()) {
    const code = hit.code.trim().toUpperCase().slice(0, 6);
    if (!isSyntheticAgentCode(code)) return code;
  }

  const derived = deriveAgencyInitials(label);
  return derived || null;
}
