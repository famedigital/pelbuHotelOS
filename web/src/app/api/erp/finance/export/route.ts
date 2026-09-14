import {
  buildBalanceSheet,
  buildGstReport,
  buildProfitAndLoss,
  buildTrialBalance,
} from "@/lib/accounting/reports";
import { buildWorkbook, toCsv } from "@/lib/accounting/export";
import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId, loadProperty } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function validDate(value: string | null, fallback: string): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return fallback;
}

function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export async function GET(request: NextRequest) {
  if (!(await isDeskAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl;
  const report = url.searchParams.get("report") ?? "pnl";
  const format = (url.searchParams.get("format") ?? "xlsx").toLowerCase();
  const from = validDate(url.searchParams.get("from"), monthStart());
  const to = validDate(
    url.searchParams.get("to"),
    new Date().toISOString().slice(0, 10),
  );
  if (from > to) {
    return NextResponse.json(
      { error: "`from` must be on or before `to`." },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const property = await loadProperty(admin, propertyId);
  const propertyName = property?.name ?? "Hotel";

  const sheets: Array<{
    name: string;
    header: string[];
    rows: (string | number | null | undefined)[][];
  }> = [];

  if (["pnl", "month_pack"].includes(report)) {
    const pnl = await buildProfitAndLoss(admin, propertyId, from, to);
    sheets.push({
      name: "Profit and Loss",
      header: ["Section", "Code", "Account", "Amount_BTN"],
      rows: [
        ...pnl.income.map((r) => ["Income", r.code, r.name, r.amount]),
        ...pnl.expenses.map((r) => ["Expense", r.code, r.name, r.amount]),
        ["Net", "", "Net income", pnl.netIncome],
      ],
    });
  }

  if (["trial", "month_pack"].includes(report)) {
    const trial = await buildTrialBalance(admin, propertyId, from, to);
    sheets.push({
      name: "Trial Balance",
      header: [
        "Code",
        "Account",
        "Type",
        "Opening_Dr",
        "Opening_Cr",
        "Period_Dr",
        "Period_Cr",
        "Closing_Dr",
        "Closing_Cr",
      ],
      rows: trial.map((r) => [
        r.code,
        r.name,
        r.accountType,
        r.openingDebit,
        r.openingCredit,
        r.periodDebit,
        r.periodCredit,
        r.closingDebit,
        r.closingCredit,
      ]),
    });
  }

  if (["balance", "month_pack"].includes(report)) {
    const balance = await buildBalanceSheet(admin, propertyId, to);
    sheets.push({
      name: "Balance Sheet",
      header: ["Section", "Code", "Account", "Amount_BTN"],
      rows: [
        ...balance.assets.map((r) => ["Asset", r.code, r.name, r.amount]),
        ...balance.liabilities.map((r) => [
          "Liability",
          r.code,
          r.name,
          r.amount,
        ]),
        ...balance.equity.map((r) => ["Equity", r.code, r.name, r.amount]),
        ["Total", "", "Assets", balance.totalAssets],
        ["Total", "", "Liabilities + Equity", balance.totalLiabilitiesEquity],
      ],
    });
  }

  if (["gst", "month_pack"].includes(report)) {
    const gst = await buildGstReport(admin, propertyId, from, to);
    sheets.push({
      name: "GST",
      header: ["Kind", "Code", "Account", "Amount_BTN"],
      rows: [
        ...gst.outputRows.map((r) => ["Output", r.code, r.name, r.amount]),
        ...gst.inputRows.map((r) => ["Input", r.code, r.name, r.amount]),
        ["Summary", "", "Output total", gst.output],
        ["Summary", "", "Input total", gst.input],
        ["Summary", "", "Net payable", gst.netPayable],
      ],
    });
  }

  if (["income", "month_pack"].includes(report)) {
    const { data: folios } = await admin
      .from("folios")
      .select(
        "id, folio_lines(created_at, source_type, description, amount_btn, gst_btn, total_btn, status)",
      )
      .eq("property_id", propertyId)
      .limit(500);
    const rows: (string | number)[][] = [];
    for (const f of folios ?? []) {
      for (const line of (f.folio_lines as Record<string, unknown>[] | null) ??
        []) {
        if (String(line.status) !== "posted") continue;
        if (String(line.created_at ?? "") < from) continue;
        if (String(line.created_at ?? "").slice(0, 10) > to) continue;
        rows.push([
          String(line.created_at).slice(0, 10),
          f.id as string,
          String(line.source_type ?? ""),
          String(line.description ?? ""),
          Number(line.amount_btn ?? 0),
          Number(line.gst_btn ?? 0),
          Number(line.total_btn ?? 0),
        ]);
      }
    }
    sheets.push({
      name: "Income",
      header: [
        "Date",
        "Folio",
        "Source",
        "Description",
        "Amount",
        "GST",
        "Total",
      ],
      rows,
    });
  }

  if (["expenses", "month_pack"].includes(report)) {
    const { data } = await admin
      .from("expenses")
      .select(
        "expense_date, category, description, amount_btn, gst_btn, payment_method, vendor, reference",
      )
      .eq("property_id", propertyId)
      .gte("expense_date", from)
      .lte("expense_date", to)
      .order("expense_date");
    sheets.push({
      name: "Expenses",
      header: [
        "Date",
        "Category",
        "Description",
        "Amount",
        "GST",
        "Method",
        "Vendor",
        "Reference",
      ],
      rows: (data ?? []).map((r) => [
        r.expense_date as string,
        r.category as string,
        r.description as string,
        Number(r.amount_btn),
        Number(r.gst_btn ?? 0),
        r.payment_method as string,
        (r.vendor as string | null) ?? "",
        (r.reference as string | null) ?? "",
      ]),
    });
  }

  if (["journals", "month_pack"].includes(report)) {
    const { data: journals } = await admin
      .from("accounting_journals")
      .select(
        "id, journal_no, journal_date, journal_kind, status, memo, accounting_journal_lines(line_no, debit_btn, credit_btn, description, accounting_accounts(code, name))",
      )
      .eq("property_id", propertyId)
      .gte("journal_date", from)
      .lte("journal_date", to)
      .order("journal_date");
    const rows: (string | number)[][] = [];
    for (const j of journals ?? []) {
      for (const line of (j.accounting_journal_lines as Record<
        string,
        unknown
      >[] | null) ?? []) {
        const account = line.accounting_accounts as
          | { code?: string; name?: string }
          | null;
        rows.push([
          j.journal_no as string,
          j.journal_date as string,
          j.journal_kind as string,
          j.status as string,
          account?.code ?? "",
          account?.name ?? "",
          Number(line.debit_btn ?? 0),
          Number(line.credit_btn ?? 0),
          String(line.description ?? j.memo ?? ""),
        ]);
      }
    }
    sheets.push({
      name: "Journals",
      header: [
        "Journal",
        "Date",
        "Kind",
        "Status",
        "Account",
        "Account name",
        "Debit",
        "Credit",
        "Description",
      ],
      rows,
    });
  }

  if (["bank_recon"].includes(report)) {
    const { data } = await admin
      .from("bank_transactions")
      .select(
        "txn_date, bank_code, description, debit_btn, credit_btn, reference, match_status",
      )
      .eq("property_id", propertyId)
      .gte("txn_date", from)
      .lte("txn_date", to)
      .order("txn_date");
    sheets.push({
      name: "Bank transactions",
      header: [
        "Date",
        "Bank",
        "Description",
        "Debit",
        "Credit",
        "Reference",
        "Status",
      ],
      rows: (data ?? []).map((r) => [
        r.txn_date as string,
        r.bank_code as string,
        r.description as string,
        Number(r.debit_btn),
        Number(r.credit_btn),
        (r.reference as string | null) ?? "",
        r.match_status as string,
      ]),
    });
  }

  if (!sheets.length) {
    return NextResponse.json({ error: "Unknown report." }, { status: 400 });
  }

  await writeAuditEvent(admin, {
    propertyId,
    action: "accounting.export",
    entityType: "exports",
    entityId: null,
    summary: `Exported ${report} (${format}) ${from}→${to}`,
    meta: { report, format, from, to },
  });

  const filename = `pelbu-${report}-${from}-to-${to}`;

  if (format === "csv") {
    const sheet = sheets[0];
    const csv = toCsv(sheet.header, sheet.rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  }

  const buffer = await buildWorkbook({
    title: `Pelbu finance · ${report}`,
    propertyName,
    from,
    to,
    sheets,
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
    },
  });
}
