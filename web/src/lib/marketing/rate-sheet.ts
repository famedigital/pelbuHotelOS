/**
 * Marketing rate sheets — freeform block document for ERP desk.
 * Easy blocks (text/table/banner) + advanced free HTML escape hatch.
 */

export const RATE_SHEET_DOC_VERSION = 1 as const;

export type RateSheetAudience = "public" | "agents" | "partners" | "custom";
export type RateSheetStatus = "draft" | "published" | "archived";

export type RateSheetBlockType =
  | "heading"
  | "paragraph"
  | "banner"
  | "table"
  | "note"
  | "cards"
  | "divider"
  | "free_html"
  /** Live logo / phone / email / address from Settings → Identity */
  | "property_contact";

export type RateSheetHeadingBlock = {
  id: string;
  type: "heading";
  level: 1 | 2 | 3;
  text: string;
};

export type RateSheetParagraphBlock = {
  id: string;
  type: "paragraph";
  text: string;
};

export type RateSheetBannerBlock = {
  id: string;
  type: "banner";
  eyebrow: string;
  title: string;
  body: string;
  tone: "peak" | "teal" | "gold" | "neutral";
};

export type RateSheetTableBlock = {
  id: string;
  type: "table";
  caption: string;
  headers: string[];
  /** grid of cell strings — rows × cols matching headers length when possible */
  rows: string[][];
};

export type RateSheetNoteBlock = {
  id: string;
  type: "note";
  text: string;
};

export type RateSheetCardsBlock = {
  id: string;
  type: "cards";
  items: { title: string; body: string }[];
};

export type RateSheetDividerBlock = {
  id: string;
  type: "divider";
};

export type RateSheetFreeHtmlBlock = {
  id: string;
  type: "free_html";
  /** Staff free-form markup; scripts stripped on save. */
  html: string;
};

/** Renders live property NAP from Settings — nothing stored in the cell. */
export type RateSheetPropertyContactBlock = {
  id: string;
  type: "property_contact";
};

export type RateSheetBlock =
  | RateSheetHeadingBlock
  | RateSheetParagraphBlock
  | RateSheetBannerBlock
  | RateSheetTableBlock
  | RateSheetNoteBlock
  | RateSheetCardsBlock
  | RateSheetDividerBlock
  | RateSheetFreeHtmlBlock
  | RateSheetPropertyContactBlock;

/** Live brand / NAP from Settings → Identity (not edited inside the sheet). */
export type RateSheetBrand = {
  name: string;
  legalName: string | null;
  logoPublicId: string | null;
  logoSrc: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  webUrl: string | null;
  webLabel: string | null;
  settingsHref: string;
};

export type RateSheetDocument = {
  version: typeof RATE_SHEET_DOC_VERSION;
  intro?: string;
  blocks: RateSheetBlock[];
};

export type MarketingRateSheetRow = {
  id: string;
  property_id: string;
  slug: string;
  title: string;
  audience: RateSheetAudience;
  status: RateSheetStatus;
  season_label: string | null;
  document: RateSheetDocument;
  notes: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export function newBlockId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function emptyRateSheetDocument(): RateSheetDocument {
  return { version: RATE_SHEET_DOC_VERSION, intro: "", blocks: [] };
}

/** Public peak card seeded from marketing/rate-public.html (peak only). */
export function publicPeakRateSheetDocument(): RateSheetDocument {
  return {
    version: RATE_SHEET_DOC_VERSION,
    intro:
      "Transparent rates for walk-in, locals, and guests booking direct. Per room, per night. All figures are all-in (include 10% service charge and 5% GST).",
    blocks: [
      {
        id: newBlockId(),
        type: "heading",
        level: 1,
        text: "Public room rates",
      },
      {
        id: newBlockId(),
        type: "banner",
        tone: "peak",
        eyebrow: "Peak season · Special rate 2026",
        title: "Valid for stays in peak months",
        body: "September · October · November 2026 · All-in BTN (10% SC + 5% GST included) · Subject to availability",
      },
      {
        id: newBlockId(),
        type: "table",
        caption: "Peak season public rates",
        headers: ["Room category", "Occupancy", "EP", "CP", "MAP"],
        rows: [
          ["Deluxe Queen", "Single", "BTN 3,000", "BTN 3,400", "BTN 4,400"],
          ["Deluxe Queen", "Double", "BTN 3,600", "BTN 4,600", "BTN 6,400"],
          ["Twin (double only)", "Double", "BTN 3,600", "BTN 4,600", "BTN 6,400"],
          ["Suite", "Single", "On request", "On request", "On request"],
          ["Suite", "Double", "BTN 7,900", "BTN 9,000", "BTN 10,700"],
        ],
      },
      {
        id: newBlockId(),
        type: "cards",
        items: [
          { title: "EP", body: "European Plan — room only (all-in)" },
          {
            title: "CP",
            body: "Room + breakfast for the priced occupancy",
          },
          {
            title: "MAP",
            body: "Room + breakfast + dinner for the priced occupancy",
          },
        ],
      },
      {
        id: newBlockId(),
        type: "cards",
        items: [
          {
            title: "Book direct",
            body: "Live availability on the hotel website (Settings → Identity)",
          },
          {
            title: "Taxes clear",
            body: "All rates include SC + GST — no add-on at check-in for these plans.",
          },
        ],
      },
      {
        id: newBlockId(),
        type: "note",
        text: "Published peak rates: Sep · Oct · Nov 2026. Other months on request / as confirmed at booking. Twin is double occupancy only. Suite single on request. Free cancel: 7 days standard · 14 days peak. Subject to availability.",
      },
      {
        id: newBlockId(),
        type: "property_contact",
      },
    ],
  };
}

export function slugifyRateSheetTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Strip scripts and event handlers from free HTML blocks. */
export function sanitizeRateSheetHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/javascript:/gi, "")
    .slice(0, 200_000);
}

export function normalizeRateSheetDocument(raw: unknown): RateSheetDocument {
  if (!raw || typeof raw !== "object") return emptyRateSheetDocument();
  const obj = raw as Record<string, unknown>;
  const blocksRaw = Array.isArray(obj.blocks) ? obj.blocks : [];
  const blocks: RateSheetBlock[] = [];

  for (const item of blocksRaw) {
    if (!item || typeof item !== "object") continue;
    const b = item as Record<string, unknown>;
    const id = typeof b.id === "string" && b.id ? b.id : newBlockId();
    const type = b.type;

    switch (type) {
      case "heading": {
        const level = b.level === 1 || b.level === 3 ? b.level : 2;
        blocks.push({
          id,
          type: "heading",
          level,
          text: String(b.text ?? "").slice(0, 500),
        });
        break;
      }
      case "paragraph":
        blocks.push({
          id,
          type: "paragraph",
          text: String(b.text ?? "").slice(0, 20_000),
        });
        break;
      case "banner":
        blocks.push({
          id,
          type: "banner",
          eyebrow: String(b.eyebrow ?? "").slice(0, 200),
          title: String(b.title ?? "").slice(0, 300),
          body: String(b.body ?? "").slice(0, 2000),
          tone:
            b.tone === "teal" || b.tone === "gold" || b.tone === "neutral"
              ? b.tone
              : "peak",
        });
        break;
      case "table": {
        const headers = Array.isArray(b.headers)
          ? b.headers.map((h) => String(h ?? "").slice(0, 200)).slice(0, 20)
          : ["Column 1"];
        const colN = Math.max(1, headers.length);
        const rowsIn = Array.isArray(b.rows) ? b.rows : [];
        const rows = rowsIn.slice(0, 100).map((row) => {
          const cells = Array.isArray(row) ? row : [];
          const out: string[] = [];
          for (let i = 0; i < colN; i++) {
            out.push(String(cells[i] ?? "").slice(0, 500));
          }
          return out;
        });
        blocks.push({
          id,
          type: "table",
          caption: String(b.caption ?? "").slice(0, 300),
          headers,
          rows,
        });
        break;
      }
      case "note":
        blocks.push({
          id,
          type: "note",
          text: String(b.text ?? "").slice(0, 10_000),
        });
        break;
      case "cards": {
        const itemsIn = Array.isArray(b.items) ? b.items : [];
        const items = itemsIn.slice(0, 12).map((it) => {
          const o = (it && typeof it === "object" ? it : {}) as Record<
            string,
            unknown
          >;
          return {
            title: String(o.title ?? "").slice(0, 120),
            body: String(o.body ?? "").slice(0, 1000),
          };
        });
        blocks.push({ id, type: "cards", items });
        break;
      }
      case "divider":
        blocks.push({ id, type: "divider" });
        break;
      case "free_html":
        blocks.push({
          id,
          type: "free_html",
          html: sanitizeRateSheetHtml(String(b.html ?? "")),
        });
        break;
      case "property_contact":
        blocks.push({ id, type: "property_contact" });
        break;
      default:
        break;
    }
  }

  return {
    version: RATE_SHEET_DOC_VERSION,
    intro:
      typeof obj.intro === "string" ? obj.intro.slice(0, 5000) : undefined,
    blocks,
  };
}

export function mapRateSheetRow(raw: Record<string, unknown>): MarketingRateSheetRow {
  return {
    id: raw.id as string,
    property_id: raw.property_id as string,
    slug: raw.slug as string,
    title: raw.title as string,
    audience: (raw.audience as RateSheetAudience) ?? "public",
    status: (raw.status as RateSheetStatus) ?? "draft",
    season_label: (raw.season_label as string | null) ?? null,
    document: normalizeRateSheetDocument(raw.document),
    notes: (raw.notes as string | null) ?? null,
    created_at: raw.created_at as string,
    updated_at: raw.updated_at as string,
    published_at: (raw.published_at as string | null) ?? null,
  };
}

export function createBlock(
  type: RateSheetBlockType,
): RateSheetBlock {
  const id = newBlockId();
  switch (type) {
    case "heading":
      return { id, type: "heading", level: 2, text: "New heading" };
    case "paragraph":
      return { id, type: "paragraph", text: "Type your text here…" };
    case "banner":
      return {
        id,
        type: "banner",
        eyebrow: "Highlight",
        title: "Banner title",
        body: "Short supporting line",
        tone: "peak",
      };
    case "table":
      return {
        id,
        type: "table",
        caption: "Rate table",
        headers: ["Category", "Occupancy", "EP", "CP", "MAP"],
        rows: [
          ["", "", "", "", ""],
          ["", "", "", "", ""],
        ],
      };
    case "note":
      return { id, type: "note", text: "Fine print / notes for guests…" };
    case "cards":
      return {
        id,
        type: "cards",
        items: [
          { title: "Card", body: "Details" },
          { title: "Card", body: "Details" },
        ],
      };
    case "divider":
      return { id, type: "divider" };
    case "free_html":
      return {
        id,
        type: "free_html",
        html: "<p><strong>Custom block</strong> — paste simple HTML (tables, lists). No scripts.</p>",
      };
    case "property_contact":
      return { id, type: "property_contact" };
  }
}

/** Parse TSV / CSV paste into a grid (for spreadsheet paste into tables). */
export function parseGridPaste(text: string): string[][] {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.length > 0);
  return lines.map((line) => {
    if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
    // simple CSV: don't fully parse quotes; good enough for rates
    return line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
  });
}
