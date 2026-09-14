export const DEFAULT_GST_RATE = 0.07;

export type DocumentDesignPreset = "classic" | "compact" | "branded";
export type DocumentPaperSize = "a4" | "thermal";
export type DocumentKind =
  | "invoice"
  | "receipt"
  | "voucher"
  | "settlement"
  | "registration";

export type PropertyDocumentDesign = {
  preset: DocumentDesignPreset;
  brand_color: string;
  accent_color: string;
  /** Short eyebrow / subtitle under hotel name */
  header_text: string;
  footer_text: string;
  /** Main document title (e.g. Booking confirmation) */
  title: string;
  /** Intro paragraph under the header */
  intro_text: string;
  /** House / commercial notes (one line per bullet) */
  notes_text: string;
  /** Legal / acknowledgment footer band */
  terms_text: string;
  show_phone: boolean;
  show_email: boolean;
  show_tax_id: boolean;
  show_address: boolean;
  show_logo: boolean;
  paper_size: DocumentPaperSize;
};

/** Arrival registration card — print design + house policies (FO + Settings). */
export type PropertyRegistrationDesign = PropertyDocumentDesign & {
  policies_text: string;
  dos_text: string;
  donts_text: string;
};

export type PropertySettings = {
  logo_public_id: string | null;
  logo_nav_size_rem: number;
  logo_nav_offset_pct: number;
  logo_nav_gap_rem: number;
  logo_nav_shift_x_rem: number;
  legal_name: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  tax_id: string | null;
  gst_rate: number;
  service_charge_rate: number;
  service_charge_default_on: boolean;
  doc_invoice: PropertyDocumentDesign;
  doc_receipt: PropertyDocumentDesign;
  doc_voucher: PropertyDocumentDesign;
  /** Agent settlement / checkout guide pack */
  doc_settlement: PropertyDocumentDesign;
  doc_registration: PropertyRegistrationDesign;
};

export const DEFAULT_LOGO_NAV_SIZE_REM = 6.5;
export const DEFAULT_LOGO_NAV_OFFSET_PCT = 42;
export const DEFAULT_LOGO_NAV_GAP_REM = 0.75;
export const DEFAULT_LOGO_NAV_SHIFT_X_REM = 0;

const BRAND = "#0c4a6e";
const ACCENT = "#0ea5e9";

function clampLogoSize(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_LOGO_NAV_SIZE_REM;
  return Math.min(12, Math.max(4, Math.round(n * 100) / 100));
}

function clampLogoOffset(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_LOGO_NAV_OFFSET_PCT;
  return Math.min(70, Math.max(20, Math.round(n * 10) / 10));
}

export function clampLogoGap(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_LOGO_NAV_GAP_REM;
  return Math.min(3, Math.max(0, Math.round(n * 100) / 100));
}

export function clampLogoShiftX(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_LOGO_NAV_SHIFT_X_REM;
  return Math.min(3, Math.max(-1.5, Math.round(n * 100) / 100));
}

function clampRate(value: unknown, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(num, 1));
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asMultiline(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  return value.replace(/\r\n/g, "\n");
}

export function defaultDocumentDesign(
  kind: "invoice" | "receipt" | "voucher" | "settlement",
): PropertyDocumentDesign {
  if (kind === "settlement") {
    return {
      preset: "classic",
      brand_color: BRAND,
      accent_color: ACCENT,
      title: "Checkout · agent settlement",
      header_text: "Guide signs in ink at desk",
      intro_text:
        "Live folio snapshot for guide acknowledgment before guests leave. Seal & email the agent after departure.",
      notes_text:
        "• Not a fiscal tax invoice — GST INV is issued from the folio only.\n• Amounts may change if desk posts further charges before seal.\n• After ink sign: camera / scan on StayHub Checkout, then seal & email agent.\n• Agent AR lines appear under “On agent AR / package”.",
      terms_text:
        "I confirm the stay dates, guest name, and folio amounts shown (including any agent AR) and accept settlement under our commercial terms with the hotel.",
      footer_text:
        "Pelbu Suites · Olakha, Thimphu · Desk evidence · not a room voucher",
      show_phone: true,
      show_email: true,
      show_tax_id: true,
      show_address: true,
      show_logo: true,
      paper_size: "a4",
    };
  }
  if (kind === "voucher") {
    return {
      preset: "branded",
      brand_color: BRAND,
      accent_color: ACCENT,
      title: "Agent voucher",
      header_text: "Present this voucher at check-in",
      intro_text:
        "Room allocation confirmation for travel agents. Rates settle on the guest folio / agent AR — not shown on this voucher.",
      notes_text:
        "• Guest must present photo ID matching the booking name.\n• Guide number required for international / package groups.\n• Early arrival subject to room readiness.\n• Not a tax invoice or payment receipt.",
      terms_text:
        "By presenting this voucher the agent confirms the stay details. Commercial terms remain on the agent contract with Pelbu Suites.",
      footer_text:
        "Pelbu Suites · Olakha, Thimphu · Agent desk voucher · no rates printed",
      show_phone: true,
      show_email: true,
      show_tax_id: false,
      show_address: true,
      show_logo: true,
      paper_size: "a4",
    };
  }
  if (kind === "receipt") {
    return {
      preset: "compact",
      brand_color: BRAND,
      accent_color: ACCENT,
      title: "Folio receipt",
      header_text: "Thank you for staying with us",
      intro_text:
        "Summary of charges and payments on this guest folio. Keep for your records.",
      notes_text:
        "• Amounts in Ngultrum (Nu).\n• GST and service charge shown where posted on the line.\n• A separate fiscal receipt number (RCP-…) appears when issued from the desk.\n• Open balance is due at checkout unless settled to an approved agent on credit.",
      terms_text:
        "This is a folio receipt. Fiscal tax documents use the hotel’s sequence when issued.",
      footer_text:
        "Pelbu Suites · Olakha, Thimphu · Please keep this receipt",
      show_phone: true,
      show_email: true,
      show_tax_id: true,
      show_address: true,
      show_logo: true,
      paper_size: "a4",
    };
  }
  // invoice / booking confirmation note
  return {
    preset: "classic",
    brand_color: BRAND,
    accent_color: ACCENT,
    title: "Booking confirmation",
    header_text: "Direct booking confirmation",
    intro_text:
      "Desk confirmation of stay dates and rooms. Not a tax invoice — GST INV issues from the guest folio after stay charges post.",
    notes_text:
      "• Check-in from 14:00 · check-out by 12:00 unless otherwise agreed.\n• Rates applied on the folio; this note lists rooms and stay only.\n• Photo ID required at arrival for every adult guest.\n• Cancellations follow hotel policy or agent contract terms.",
    terms_text:
      "Please verify names and dates. Contact the desk if any detail is incorrect before arrival.",
    footer_text:
      "Pelbu Suites · Olakha, Thimphu · All amounts in Ngultrum (Nu) on folio",
    show_phone: true,
    show_email: true,
    show_tax_id: true,
    show_address: true,
    show_logo: true,
    paper_size: "a4",
  };
}

export function defaultRegistrationDesign(): PropertyRegistrationDesign {
  const base = defaultDocumentDesign("invoice");
  return {
    ...base,
    title: "Guest registration card",
    header_text: "Guest arrival registration",
    intro_text:
      "Please verify all details carefully and sign below. This hotel copy is kept with your folio for the stay.",
    notes_text: "",
    terms_text:
      "I confirm that the particulars above are true and that I have read the house policies and guests’ dos & don’ts. I (or my sponsoring agent) accept liability for all charges incurred by my party during the stay.",
    footer_text:
      "Pelbu Suites · Olakha, Thimphu · Guest registration · Hotel copy",
    show_tax_id: false,
    policies_text:
      "• Standard check-in 14:00 · check-out 12:00 (or as agreed on the booking).\n• Valid photo ID (CID / passport) required for every adult on the room.\n• Room key cards remain hotel property; lost keys may be charged.\n• Settlements: room, F&B, minibar, laundry and guest services are charged to the guest folio unless charged to an approved agent.\n• Damages, missing items and excessive cleaning are posted to the folio at replacement cost.\n• Early check-in / late check-out is subject to availability and may attract a half- or full-day charge.\n• Valuables: use the in-room safe; the hotel is not liable for unsecured items.\n• Fire safety: locate exits; do not block corridors or stairwells.",
    dos_text:
      "• Keep noise respectful after 22:00.\n• Smoke only in designated outdoor areas.\n• Report maintenance or security concerns to reception immediately.\n• Wear appropriate attire in shared spaces and restaurant.\n• Register all accompanying guests and vehicles at the desk.\n• Carry your room key and ID when leaving the property.",
    donts_text:
      "• No smoking, incense or open flame in guest rooms or balconies.\n• No cooking / high-power appliances not issued by the hotel.\n• No illicit substances; weapons are not permitted on the property.\n• Do not re-assign or share rooms without informing reception.\n• Do not hang laundry or drapery over balconies or indoor heaters.\n• Do not leave children unattended in public areas or pools.",
  };
}

export function mapDocumentDesign(
  raw: unknown,
  kind: "invoice" | "receipt" | "voucher" | "settlement",
): PropertyDocumentDesign {
  const fallback = defaultDocumentDesign(kind);
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const preset = row.preset;
  const paper = row.paper_size;
  return {
    preset:
      preset === "classic" || preset === "compact" || preset === "branded"
        ? preset
        : fallback.preset,
    brand_color: asText(row.brand_color) ?? fallback.brand_color,
    accent_color: asText(row.accent_color) ?? fallback.accent_color,
    header_text: asText(row.header_text) ?? fallback.header_text,
    footer_text: asText(row.footer_text) ?? fallback.footer_text,
    title: asText(row.title) ?? fallback.title,
    intro_text: asMultiline(row.intro_text, fallback.intro_text),
    notes_text: asMultiline(row.notes_text, fallback.notes_text),
    terms_text: asMultiline(row.terms_text, fallback.terms_text),
    show_phone:
      typeof row.show_phone === "boolean" ? row.show_phone : fallback.show_phone,
    show_email:
      typeof row.show_email === "boolean" ? row.show_email : fallback.show_email,
    show_tax_id:
      typeof row.show_tax_id === "boolean" ? row.show_tax_id : fallback.show_tax_id,
    show_address:
      typeof row.show_address === "boolean" ? row.show_address : fallback.show_address,
    show_logo:
      typeof row.show_logo === "boolean" ? row.show_logo : fallback.show_logo,
    paper_size:
      paper === "a4" || paper === "thermal"
        ? paper
        : kind === "receipt"
          ? fallback.paper_size
          : "a4",
  };
}

export function mapRegistrationDesign(
  raw: unknown,
): PropertyRegistrationDesign {
  const fallback = defaultRegistrationDesign();
  const base = mapDocumentDesign(raw ?? fallback, "invoice");
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    ...base,
    brand_color: asText(row.brand_color) ?? fallback.brand_color,
    accent_color: asText(row.accent_color) ?? fallback.accent_color,
    header_text: asText(row.header_text) ?? fallback.header_text,
    footer_text: asText(row.footer_text) ?? fallback.footer_text,
    title: asText(row.title) ?? fallback.title,
    intro_text: asMultiline(row.intro_text, fallback.intro_text),
    terms_text: asMultiline(row.terms_text, fallback.terms_text),
    notes_text: asMultiline(row.notes_text, fallback.notes_text),
    show_tax_id:
      typeof row.show_tax_id === "boolean"
        ? row.show_tax_id
        : fallback.show_tax_id,
    show_logo:
      typeof row.show_logo === "boolean" ? row.show_logo : fallback.show_logo,
    paper_size: "a4",
    policies_text: asMultiline(row.policies_text, fallback.policies_text),
    dos_text: asMultiline(row.dos_text, fallback.dos_text),
    donts_text: asMultiline(row.donts_text, fallback.donts_text),
  };
}

/** Split policy / notes / do / don't body into printable lines. */
export function registrationLines(text: string | null | undefined): string[] {
  if (typeof text !== "string" || !text.trim()) return [];
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^\s*[•\-\*]\s*/, "").trim())
    .filter(Boolean);
}

export function mapPropertySettings(row: Record<string, unknown>): PropertySettings {
  return {
    logo_public_id: asText(row.logo_public_id),
    logo_nav_size_rem: clampLogoSize(row.logo_nav_size_rem),
    logo_nav_offset_pct: clampLogoOffset(row.logo_nav_offset_pct),
    logo_nav_gap_rem: clampLogoGap(row.logo_nav_gap_rem),
    logo_nav_shift_x_rem: clampLogoShiftX(row.logo_nav_shift_x_rem),
    legal_name: asText(row.legal_name),
    address: asText(row.address),
    phone: asText(row.phone),
    whatsapp: asText(row.whatsapp),
    email: asText(row.email),
    tax_id: asText(row.tax_id),
    gst_rate: clampRate(row.gst_rate, DEFAULT_GST_RATE),
    service_charge_rate: clampRate(row.service_charge_rate, 0),
    service_charge_default_on: Boolean(row.service_charge_default_on),
    doc_invoice: mapDocumentDesign(row.doc_invoice, "invoice"),
    doc_receipt: mapDocumentDesign(row.doc_receipt, "receipt"),
    doc_voucher: mapDocumentDesign(row.doc_voucher, "voucher"),
    doc_settlement: mapDocumentDesign(row.doc_settlement, "settlement"),
    doc_registration: mapRegistrationDesign(row.doc_registration),
  };
}

export function percentToRate(value: string): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return clampRate(num / 100, 0);
}

export function rateToPercent(value: number): string {
  return String(Math.round(value * 10000) / 100);
}
