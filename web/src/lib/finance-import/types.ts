export type FinanceImportKind = "receipt" | "bank";
export type ParserStatus = "draft" | "tested" | "approved" | "retired";
export type BatchStatus =
  | "uploaded"
  | "queued"
  | "processing"
  | "review"
  | "committed"
  | "error"
  | "cancelled";

export type BankCode = "bob" | "bnb" | "tbank" | "drukpnb" | "other";

export const EXPENSE_CATEGORIES = [
  "supplies",
  "utilities",
  "payroll",
  "maintenance",
  "marketing",
  "tax",
  "bank_fee",
  "rent",
  "other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const PAY_METHODS = ["cash", "bank", "card"] as const;
export type PayMethod = (typeof PAY_METHODS)[number];

export const FINANCE_PRIVATE_BUCKET = "finance-private";
export const MAX_FINANCE_UPLOAD_BYTES = 25 * 1024 * 1024;

export const ALLOWED_RECEIPT_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const ALLOWED_PARSER_MIMES = new Set([
  "text/x-python",
  "application/x-python-code",
  "text/plain",
  "application/octet-stream",
]);

export type ExpenseGridRow = {
  id: string;
  clientId?: string;
  isNew?: boolean;
  dirty?: boolean;
  expense_date: string;
  bill_no: string;
  vendor: string;
  vendor_id?: string | null;
  tpn: string;
  description: string;
  category: ExpenseCategory | string;
  payment_method: PayMethod | string;
  amount_btn: number;
  gst_btn: number;
  net_btn: number;
  status: "draft" | "posted" | "void" | string;
  journal_id: string | null;
  notes: string;
  reference: string;
  receipt_path: string | null;
  receipt_preview_url?: string | null;
  validation?: string[];
};

export type StagedReceiptRow = {
  id: string;
  row_no: number;
  selected: boolean;
  bill_no: string | null;
  vendor: string | null;
  tpn: string | null;
  expense_date: string | null;
  category: string | null;
  description: string | null;
  payment_method: string | null;
  amount_btn: number;
  gst_btn: number;
  net_btn: number;
  page_no: number | null;
  confidence: number | null;
  warnings: string[];
  is_duplicate: boolean;
  validation_errors: string[];
  attachment_storage_path: string | null;
};

export type StagedBankRow = {
  id: string;
  row_no: number;
  selected: boolean;
  txn_date: string | null;
  value_date: string | null;
  description: string | null;
  debit_btn: number;
  credit_btn: number;
  balance_btn: number | null;
  reference: string | null;
  account_no: string | null;
  payment_mode: string | null;
  category: string | null;
  merchant: string | null;
  fingerprint: string | null;
  confidence: number | null;
  warnings: string[];
  is_duplicate: boolean;
  validation_errors: string[];
  raw: Record<string, unknown>;
};

export type FinanceImportBatch = {
  id: string;
  kind: FinanceImportKind;
  bank_code: string | null;
  account_label: string | null;
  source_filename: string;
  source_mime: string;
  source_sha256: string;
  source_storage_path: string;
  parser_script_id: string | null;
  parser_version_id: string | null;
  parser_sha256: string | null;
  parser_label: string | null;
  status: BatchStatus;
  gemini_model: string | null;
  error_message: string | null;
  logs: string | null;
  row_count: number;
  selected_count: number;
  committed_count: number;
  totals: Record<string, unknown>;
  bank_statement_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ParserScriptListItem = {
  id: string;
  kind: FinanceImportKind;
  bank_code: string | null;
  name: string;
  description: string | null;
  is_builtin: boolean;
  default_for_kind: boolean;
  latest_version: {
    id: string;
    version_label: string;
    version_no: number;
    sha256: string;
    status: ParserStatus;
    requires_gemini: boolean;
    gemini_model: string | null;
    tested_at: string | null;
    approved_at: string | null;
    created_at: string;
  } | null;
};
