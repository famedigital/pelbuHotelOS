import { createHash } from "crypto";
import {
  EXPENSE_CATEGORIES,
  PAY_METHODS,
  type ExpenseCategory,
  type PayMethod,
} from "@/lib/finance-import/types";
import { roundBtn } from "@/lib/pricing";

export function sha256Hex(buf: Buffer | ArrayBuffer | string): string {
  const data =
    typeof buf === "string"
      ? Buffer.from(buf)
      : Buffer.isBuffer(buf)
        ? buf
        : Buffer.from(buf);
  return createHash("sha256").update(data).digest("hex");
}

export function isExpenseCategory(value: string): value is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}

export function isPayMethod(value: string): value is PayMethod {
  return (PAY_METHODS as readonly string[]).includes(value);
}

export function normalizeCategory(raw: string | null | undefined): ExpenseCategory {
  const v = String(raw ?? "").trim().toLowerCase();
  return isExpenseCategory(v) ? v : "other";
}

export function normalizePayMethod(raw: string | null | undefined): PayMethod {
  const v = String(raw ?? "").trim().toLowerCase();
  return isPayMethod(v) ? v : "bank";
}

export function parseMoneyField(raw: unknown, label: string, allowZero = true): number {
  const n = Number(String(raw ?? "").replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n < 0 || (!allowZero && n <= 0)) {
    throw new Error(`${label} must be a ${allowZero ? "non-negative" : "positive"} amount.`);
  }
  return roundBtn(n);
}

/** File magic checks for PDF / JPEG / PNG / WebP. */
export function sniffAllowedFinanceMime(
  bytes: Buffer,
  declaredMime: string,
): string | null {
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  if (declaredMime === "text/x-python" || declaredMime === "text/plain") {
    const head = bytes.subarray(0, Math.min(bytes.length, 200)).toString("utf8");
    if (head.includes("def parse") || head.startsWith("#!") || head.includes("import ")) {
      return "text/x-python";
    }
  }
  return null;
}

export function validateExpenseDraft(row: {
  expense_date?: string | null;
  description?: string | null;
  amount_btn?: number;
  gst_btn?: number;
  category?: string | null;
}): string[] {
  const errors: string[] = [];
  if (!row.expense_date || !/^\d{4}-\d{2}-\d{2}$/.test(row.expense_date)) {
    errors.push("date_required");
  }
  if (!String(row.description ?? "").trim()) errors.push("description_required");
  if (!(Number(row.amount_btn) > 0)) errors.push("amount_required");
  if (Number(row.gst_btn ?? 0) < 0) errors.push("gst_invalid");
  if (row.category && !isExpenseCategory(String(row.category).toLowerCase())) {
    errors.push("category_invalid");
  }
  return errors;
}

/**
 * GST rules: never invent input tax from TPN alone.
 * Use printed GST when present; otherwise flag for review.
 */
export function resolveReceiptTax(input: {
  amountBtn: number;
  gstBtn: number | null | undefined;
  gstPrinted: boolean;
  tpn?: string | null;
}): { amountBtn: number; gstBtn: number; netBtn: number; warnings: string[] } {
  const warnings: string[] = [];
  const amountBtn = roundBtn(Math.max(0, input.amountBtn));
  let gstBtn = roundBtn(Math.max(0, Number(input.gstBtn ?? 0)));

  if (!input.gstPrinted) {
    gstBtn = 0;
    warnings.push("gst_not_printed_review_required");
    if (input.tpn?.trim()) {
      warnings.push("tpn_present_gst_unconfirmed");
    }
  }

  const netBtn = roundBtn(Math.max(0, amountBtn - gstBtn));
  return { amountBtn, gstBtn, netBtn, warnings };
}

export function bankFingerprint(parts: {
  bankCode: string;
  txnDate: string;
  description: string;
  debit: number;
  credit: number;
  reference?: string | null;
}): string {
  return createHash("sha256")
    .update(
      [
        parts.bankCode,
        parts.txnDate,
        parts.description.trim().toLowerCase(),
        parts.debit.toFixed(2),
        parts.credit.toFixed(2),
        (parts.reference ?? "").toLowerCase(),
      ].join("|"),
    )
    .digest("hex")
    .slice(0, 40);
}
