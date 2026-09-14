import { requireWorkerAuth, jsonError } from "@/lib/finance-import/api-auth";
import {
  bankFingerprint,
  normalizeCategory,
  resolveReceiptTax,
} from "@/lib/finance-import/validation";
import { financeStoragePath, uploadFinanceObject } from "@/lib/finance-import/storage";
import { roundBtn } from "@/lib/pricing";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type ReceiptIn = {
  bill_no?: string | null;
  vendor?: string | null;
  tpn?: string | null;
  expense_date?: string | null;
  category?: string | null;
  description?: string | null;
  amount_btn?: number;
  gst_btn?: number | null;
  gst_printed?: boolean;
  net_btn?: number | null;
  currency?: string;
  page_no?: number | null;
  confidence?: number | null;
  warnings?: string[];
};

type BankIn = {
  txn_date?: string | null;
  value_date?: string | null;
  description?: string | null;
  debit_btn?: number;
  credit_btn?: number;
  balance_btn?: number | null;
  reference?: string | null;
  account_no?: string | null;
  payment_mode?: string | null;
  category?: string | null;
  merchant?: string | null;
  fingerprint?: string | null;
  confidence?: number | null;
  warnings?: string[];
  raw?: Record<string, unknown>;
};

export async function POST(request: NextRequest) {
  const auth = requireWorkerAuth(request);
  if (auth.error) return auth.error;
  const { admin } = auth;

  let body: {
    batchId?: string;
    batch_id?: string;
    propertyId?: string;
    property_id?: string;
    parserSha256?: string | null;
    parser_sha256?: string | null;
    ok?: boolean;
    status?: string;
    errorMessage?: string | null;
    error_message?: string | null;
    logs?: string | null;
    rows?: Array<ReceiptIn | BankIn>;
    rawOutput?: unknown;
    raw_output?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError("Invalid JSON.");
  }

  const batchId = String(body.batchId ?? body.batch_id ?? "");
  let propertyId = String(body.propertyId ?? body.property_id ?? "");
  const parserSha = body.parserSha256 ?? body.parser_sha256 ?? null;
  const errorMessage = body.errorMessage ?? body.error_message ?? null;
  const rawOutput = body.rawOutput ?? body.raw_output ?? null;
  const ok =
    body.ok !== false &&
    body.status !== "error" &&
    !errorMessage;

  if (!batchId) return jsonError("batchId required.");

  let batchQuery = admin.from("finance_import_batches").select("*").eq("id", batchId);
  if (propertyId) batchQuery = batchQuery.eq("property_id", propertyId);
  const { data: batch } = await batchQuery.maybeSingle();
  if (!batch) return jsonError("Batch not found.", 404);
  propertyId = batch.property_id as string;

  if (batch.status !== "processing") {
    return jsonError(`Rejecting callback for batch in status ${batch.status}.`, 409);
  }
  if (parserSha && batch.parser_sha256 && parserSha !== batch.parser_sha256) {
    return jsonError("Parser SHA mismatch.", 409);
  }

  if (!ok) {
    const attempts = Number(batch.attempt_count ?? 1);
    const max = Number(batch.max_attempts ?? 3);
    const nextStatus = attempts >= max ? "error" : "queued";
    await admin
      .from("finance_import_batches")
      .update({
        status: nextStatus,
        error_message: errorMessage ?? "Worker failed.",
        logs: body.logs ?? batch.logs,
        finished_at: nextStatus === "error" ? new Date().toISOString() : null,
        worker_id: nextStatus === "queued" ? null : batch.worker_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", batchId);
    return NextResponse.json({ ok: true, status: nextStatus });
  }

  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) {
    await admin
      .from("finance_import_batches")
      .update({
        status: "error",
        error_message: "Parser returned zero rows.",
        logs: body.logs ?? null,
        finished_at: new Date().toISOString(),
      })
      .eq("id", batchId);
    return jsonError("Zero rows.", 422);
  }

  let rawPath: string | null = null;
  if (rawOutput != null) {
    rawPath = financeStoragePath(propertyId, "raw", `${batchId}.json`);
    await uploadFinanceObject(
      admin,
      rawPath,
      Buffer.from(JSON.stringify(rawOutput), "utf8"),
      "application/json",
    );
  }

  // Clear prior staged rows on retry
  if (batch.kind === "receipt") {
    await admin.from("finance_staged_receipt_rows").delete().eq("batch_id", batchId);
    const staged = rows.map((raw, idx) => {
      const r = raw as ReceiptIn;
      const tax = resolveReceiptTax({
        amountBtn: Number(r.amount_btn ?? 0),
        gstBtn: r.gst_btn,
        gstPrinted: r.gst_printed === true || Number(r.gst_btn ?? 0) > 0,
        tpn: r.tpn,
      });
      const warnings = [...(r.warnings ?? []), ...tax.warnings];
      const validation: string[] = [];
      if (!r.expense_date) validation.push("date_required");
      if (!(tax.amountBtn > 0)) validation.push("amount_required");

      return {
        property_id: propertyId,
        batch_id: batchId,
        row_no: idx + 1,
        selected: validation.length === 0,
        bill_no: r.bill_no ?? null,
        vendor: r.vendor ?? null,
        tpn: r.tpn ?? null,
        expense_date: r.expense_date ?? null,
        category: normalizeCategory(r.category),
        description:
          r.description ??
          ([r.vendor, r.bill_no].filter(Boolean).join(" · ") || "Receipt"),
        payment_method: "bank",
        amount_btn: tax.amountBtn,
        gst_btn: tax.gstBtn,
        net_btn: tax.netBtn || roundBtn(tax.amountBtn - tax.gstBtn),
        currency: r.currency ?? "BTN",
        page_no: r.page_no ?? null,
        confidence: r.confidence ?? null,
        warnings,
        raw: r,
        validation_errors: validation,
        attachment_storage_path: batch.source_storage_path,
        is_duplicate: false,
      };
    });

    // Dedupe within batch by bill_no+vendor+amount+date
    const seen = new Map<string, number>();
    for (const row of staged) {
      const key = [
        row.bill_no ?? "",
        (row.vendor ?? "").toLowerCase(),
        row.expense_date ?? "",
        Number(row.amount_btn).toFixed(2),
      ].join("|");
      if (seen.has(key)) {
        row.is_duplicate = true;
        row.selected = false;
        row.validation_errors = [...row.validation_errors, "duplicate_in_batch"];
      } else {
        seen.set(key, row.row_no);
      }
    }

    const { error: insErr } = await admin.from("finance_staged_receipt_rows").insert(staged);
    if (insErr) {
      console.error(insErr);
      return jsonError("Could not stage receipt rows.", 500);
    }

    const totals = {
      count: staged.length,
      selected: staged.filter((s) => s.selected).length,
      amount: roundBtn(staged.reduce((s, r) => s + Number(r.amount_btn), 0)),
      gst: roundBtn(staged.reduce((s, r) => s + Number(r.gst_btn), 0)),
    };

    await admin
      .from("finance_import_batches")
      .update({
        status: "review",
        row_count: staged.length,
        selected_count: totals.selected,
        totals,
        logs: body.logs ?? null,
        raw_output_path: rawPath,
        raw_output: rawOutput,
        error_message: null,
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", batchId);

    return NextResponse.json({ ok: true, status: "review", rowCount: staged.length });
  }

  // Bank
  await admin.from("finance_staged_bank_rows").delete().eq("batch_id", batchId);
  const bankCode = String(batch.bank_code ?? "bob");
  const stagedBank = rows.map((raw, idx) => {
    const r = raw as BankIn;
    const debit = roundBtn(Math.max(0, Number(r.debit_btn ?? 0)));
    const credit = roundBtn(Math.max(0, Number(r.credit_btn ?? 0)));
    const desc = String(r.description ?? "").trim();
    const txnDate = r.txn_date ?? null;
    const fp =
      r.fingerprint ||
      (txnDate && desc
        ? bankFingerprint({
            bankCode,
            txnDate,
            description: desc,
            debit,
            credit,
            reference: r.reference,
          })
        : null);
    const validation: string[] = [];
    if (!txnDate) validation.push("date_required");
    if (!desc) validation.push("description_required");
    if (debit > 0 && credit > 0) validation.push("amount_xor");

    return {
      property_id: propertyId,
      batch_id: batchId,
      row_no: idx + 1,
      selected: validation.length === 0,
      txn_date: txnDate,
      value_date: r.value_date ?? null,
      description: desc || null,
      debit_btn: debit,
      credit_btn: credit,
      balance_btn: r.balance_btn == null ? null : roundBtn(Number(r.balance_btn)),
      reference: r.reference ?? null,
      account_no: r.account_no ?? null,
      payment_mode: r.payment_mode ?? null,
      category: r.category ?? null,
      merchant: r.merchant ?? null,
      fingerprint: fp,
      confidence: r.confidence ?? null,
      warnings: r.warnings ?? [],
      raw: r.raw ?? r,
      validation_errors: validation,
      is_duplicate: false,
    };
  });

  const fpSeen = new Set<string>();
  for (const row of stagedBank) {
    if (row.fingerprint && fpSeen.has(row.fingerprint)) {
      row.is_duplicate = true;
      row.selected = false;
      row.validation_errors = [...row.validation_errors, "duplicate_fingerprint"];
    } else if (row.fingerprint) {
      fpSeen.add(row.fingerprint);
    }
  }

  const { error: bankInsErr } = await admin
    .from("finance_staged_bank_rows")
    .insert(stagedBank);
  if (bankInsErr) {
    console.error(bankInsErr);
    return jsonError("Could not stage bank rows.", 500);
  }

  const bankTotals = {
    count: stagedBank.length,
    selected: stagedBank.filter((s) => s.selected).length,
    debit: roundBtn(stagedBank.reduce((s, r) => s + Number(r.debit_btn), 0)),
    credit: roundBtn(stagedBank.reduce((s, r) => s + Number(r.credit_btn), 0)),
  };

  await admin
    .from("finance_import_batches")
    .update({
      status: "review",
      row_count: stagedBank.length,
      selected_count: bankTotals.selected,
      totals: bankTotals,
      logs: body.logs ?? null,
      raw_output_path: rawPath,
      raw_output: rawOutput,
      error_message: null,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", batchId);

  return NextResponse.json({ ok: true, status: "review", rowCount: stagedBank.length });
}
