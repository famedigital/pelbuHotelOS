export const DEFAULT_GST_RATE = 0.07;

export type DocumentDesignPreset = "classic" | "compact" | "branded";
export type DocumentPaperSize = "a4" | "thermal";

export type PropertyDocumentDesign = {
  preset: DocumentDesignPreset;
  brand_color: string;
  accent_color: string;
  header_text: string;
  footer_text: string;
  show_phone: boolean;
  show_email: boolean;
  show_tax_id: boolean;
  show_address: boolean;
  paper_size: DocumentPaperSize;
};

export type PropertySettings = {
  logo_public_id: string | null;
  legal_name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  tax_id: string | null;
  gst_rate: number;
  service_charge_rate: number;
  service_charge_default_on: boolean;
  doc_invoice: PropertyDocumentDesign;
  doc_receipt: PropertyDocumentDesign;
  doc_voucher: PropertyDocumentDesign;
};

function clampRate(value: unknown, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(num, 1));
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function defaultDocumentDesign(
  kind: "invoice" | "receipt" | "voucher",
): PropertyDocumentDesign {
  return {
    preset: kind === "voucher" ? "branded" : kind === "receipt" ? "compact" : "classic",
    brand_color: "#7b1e3a",
    accent_color: "#d46f92",
    header_text:
      kind === "voucher"
        ? "Present at check-in."
        : kind === "receipt"
          ? "Thank you for staying with us."
          : "Direct billing summary.",
    footer_text:
      kind === "receipt"
        ? "Please keep this receipt for your records."
        : kind === "voucher"
          ? "Rates and taxes settle on the guest folio."
          : "All amounts in Ngultrum (Nu).",
    show_phone: true,
    show_email: true,
    show_tax_id: kind !== "voucher",
    show_address: true,
    paper_size: kind === "receipt" ? "thermal" : "a4",
  };
}

export function mapDocumentDesign(
  raw: unknown,
  kind: "invoice" | "receipt" | "voucher",
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
    show_phone:
      typeof row.show_phone === "boolean" ? row.show_phone : fallback.show_phone,
    show_email:
      typeof row.show_email === "boolean" ? row.show_email : fallback.show_email,
    show_tax_id:
      typeof row.show_tax_id === "boolean" ? row.show_tax_id : fallback.show_tax_id,
    show_address:
      typeof row.show_address === "boolean" ? row.show_address : fallback.show_address,
    paper_size: paper === "a4" || paper === "thermal" ? paper : fallback.paper_size,
  };
}

export function mapPropertySettings(row: Record<string, unknown>): PropertySettings {
  return {
    logo_public_id: asText(row.logo_public_id),
    legal_name: asText(row.legal_name),
    address: asText(row.address),
    phone: asText(row.phone),
    email: asText(row.email),
    tax_id: asText(row.tax_id),
    gst_rate: clampRate(row.gst_rate, DEFAULT_GST_RATE),
    service_charge_rate: clampRate(row.service_charge_rate, 0),
    service_charge_default_on: Boolean(row.service_charge_default_on),
    doc_invoice: mapDocumentDesign(row.doc_invoice, "invoice"),
    doc_receipt: mapDocumentDesign(row.doc_receipt, "receipt"),
    doc_voucher: mapDocumentDesign(row.doc_voucher, "voucher"),
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
