import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId, thimphuToday } from "@/lib/erp-lists";
import { loadAgentProductionReport } from "@/lib/reports/agent-dossier";
import {
  loadAgentArReport,
  loadInventoryMovementsSummary,
  loadStaffAttendanceSummary,
} from "@/lib/reports/catalog";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function csvEscape(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvResponse(kind: string, since: string, header: string[], rows: string[][]) {
  const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n") + "\n";
  const filename = `pelbu-${kind}-${since}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

/** Accounting + catalog report exports. */
export async function GET(request: Request) {
  if (!(await isDeskAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? "payments";
  const since =
    url.searchParams.get("since") ??
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;
  const until =
    url.searchParams.get("until") ?? new Date().toISOString().slice(0, 10);
  const agentId = url.searchParams.get("agent_id") ?? undefined;
  const staffId = url.searchParams.get("staff_id") ?? undefined;
  const category = url.searchParams.get("category") ?? undefined;

  const admin = createSupabaseAdminClient();

  if (
    kind === "agent-production" ||
    kind === "agent-ar" ||
    kind === "staff-attendance" ||
    kind === "inventory-movements"
  ) {
    const propertyId = await requireDeskPropertyId();
    const today = thimphuToday();

    if (kind === "agent-production") {
      const rows = await loadAgentProductionReport(admin, {
        propertyId,
        from: since,
        to: until,
        agentId,
      });
      return csvResponse(
        kind,
        since,
        [
          "agent_id",
          "company_name",
          "bookings",
          "rooms",
          "room_nights",
          "quoted_total",
        ],
        rows.map((r) => [
          csvEscape(r.agent_id),
          csvEscape(r.company_name),
          csvEscape(r.bookings),
          csvEscape(r.rooms),
          csvEscape(r.room_nights),
          csvEscape(r.quoted_total),
        ]),
      );
    }

    if (kind === "agent-ar") {
      let rows = await loadAgentArReport(admin, {
        propertyId,
        from: since,
        to: until,
        today,
      });
      if (agentId) rows = rows.filter((r) => r.agent_id === agentId);
      return csvResponse(
        kind,
        since,
        [
          "agent_id",
          "company_name",
          "bookings_in_range",
          "outstanding",
          "aging_total",
          "credit_used",
          "credit_limit",
          "habit",
        ],
        rows.map((r) => [
          csvEscape(r.agent_id),
          csvEscape(r.company_name),
          csvEscape(r.bookings_in_range),
          csvEscape(r.outstanding),
          csvEscape(r.aging_total),
          csvEscape(r.credit_used),
          csvEscape(r.credit_limit),
          csvEscape(r.habit),
        ]),
      );
    }

    if (kind === "staff-attendance") {
      const rows = await loadStaffAttendanceSummary(admin, {
        propertyId,
        from: since,
        to: until,
        staffId,
      });
      return csvResponse(
        kind,
        since,
        [
          "staff_id",
          "full_name",
          "events",
          "clock_ins",
          "clock_outs",
          "estimated_hours",
        ],
        rows.map((r) => [
          csvEscape(r.staff_id),
          csvEscape(r.full_name),
          csvEscape(r.events),
          csvEscape(r.clock_ins),
          csvEscape(r.clock_outs),
          csvEscape(r.estimated_hours),
        ]),
      );
    }

    const { rows } = await loadInventoryMovementsSummary(admin, {
      propertyId,
      from: since,
      to: until,
      category,
    });
    return csvResponse(
      kind,
      since,
      ["item_id", "item_name", "category", "movement_kind", "qty", "value_btn"],
      rows.map((r) => [
        csvEscape(r.item_id),
        csvEscape(r.item_name),
        csvEscape(r.category),
        csvEscape(r.movement_kind),
        csvEscape(r.qty),
        csvEscape(r.value_btn),
      ]),
    );
  }

  const { data: property } = await admin
    .from("properties")
    .select("id")
    .eq("slug", PELBU_PROPERTY_SLUG)
    .single();
  if (!property) {
    return NextResponse.json({ error: "Property missing" }, { status: 500 });
  }
  const pid = property.id as string;

  let header: string[] = [];
  let rows: string[][] = [];

  if (kind === "expenses") {
    header = [
      "expense_date",
      "category",
      "description",
      "amount_btn",
      "gst_btn",
      "payment_method",
      "vendor",
      "reference",
    ];
    const { data } = await admin
      .from("expenses")
      .select(header.join(","))
      .eq("property_id", pid)
      .gte("expense_date", since)
      .order("expense_date");
    rows = (data ?? []).map((r) =>
      header.map((h) => csvEscape((r as unknown as Record<string, unknown>)[h])),
    );
  } else if (kind === "gst_filing") {
    header = [
      "doc_no",
      "doc_kind",
      "status",
      "issued_at",
      "fiscal_year",
      "period",
      "folio_id",
      "booking_id",
      "taxable_btn",
      "gst_btn",
      "total_btn",
    ];
    const { data: docs } = await admin
      .from("fiscal_documents")
      .select(
        "doc_no, doc_kind, status, issued_at, fiscal_year, folio_id, booking_id, meta, period_id, accounting_periods(label, starts_on, ends_on)",
      )
      .eq("property_id", pid)
      .gte("issued_at", since)
      .lte("issued_at", `${until}T23:59:59.999Z`)
      .order("issued_at")
      .limit(2000);

    const folioIds = [
      ...new Set(
        (docs ?? [])
          .map((d) => d.folio_id as string | null)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const totalsByFolio = new Map<
      string,
      { taxable: number; gst: number; total: number }
    >();
    if (folioIds.length > 0) {
      const { data: folios } = await admin
        .from("folios")
        .select(
          "id, folio_lines(amount_btn, gst_btn, total_btn, status, gst_applicable)",
        )
        .in("id", folioIds);
      for (const f of folios ?? []) {
        let taxable = 0;
        let gst = 0;
        let total = 0;
        for (const line of (f.folio_lines as {
          amount_btn: number;
          gst_btn: number;
          total_btn: number;
          status: string;
          gst_applicable?: boolean;
        }[] | null) ?? []) {
          if (line.status !== "posted") continue;
          total += Number(line.total_btn ?? 0);
          gst += Number(line.gst_btn ?? 0);
          if (line.gst_applicable) taxable += Number(line.amount_btn ?? 0);
        }
        totalsByFolio.set(f.id as string, { taxable, gst, total });
      }
    }

    for (const d of docs ?? []) {
      const period = d.accounting_periods as
        | { label?: string; starts_on?: string; ends_on?: string }
        | { label?: string; starts_on?: string; ends_on?: string }[]
        | null;
      const periodObj = Array.isArray(period) ? period[0] : period;
      const periodLabel =
        periodObj?.label ||
        (periodObj?.starts_on && periodObj?.ends_on
          ? `${periodObj.starts_on}→${periodObj.ends_on}`
          : String(d.fiscal_year ?? ""));
      const totals = totalsByFolio.get(d.folio_id as string) ?? {
        taxable: 0,
        gst: 0,
        total: 0,
      };
      rows.push([
        csvEscape(d.doc_no),
        csvEscape(d.doc_kind),
        csvEscape(d.status),
        csvEscape(d.issued_at),
        csvEscape(d.fiscal_year),
        csvEscape(periodLabel),
        csvEscape(d.folio_id),
        csvEscape(d.booking_id),
        csvEscape(totals.taxable),
        csvEscape(totals.gst),
        csvEscape(totals.total),
      ]);
    }
  } else if (kind === "folio_lines") {
    header = [
      "created_at",
      "folio_id",
      "source_type",
      "description",
      "qty",
      "amount_btn",
      "gst_btn",
      "total_btn",
      "status",
    ];
    const { data: folios } = await admin
      .from("folios")
      .select(
        "id, folio_lines(created_at, source_type, description, qty, amount_btn, gst_btn, total_btn, status)",
      )
      .eq("property_id", pid)
      .limit(500);
    for (const f of folios ?? []) {
      const lines = (f.folio_lines as Record<string, unknown>[] | null) ?? [];
      for (const line of lines) {
        if (String(line.created_at ?? "") < since) continue;
        rows.push([
          csvEscape(line.created_at),
          csvEscape(f.id),
          csvEscape(line.source_type),
          csvEscape(line.description),
          csvEscape(line.qty),
          csvEscape(line.amount_btn),
          csvEscape(line.gst_btn),
          csvEscape(line.total_btn),
          csvEscape(line.status),
        ]);
      }
    }
  } else {
    header = [
      "created_at",
      "method",
      "amount_btn",
      "reference",
      "folio_id",
      "booking_id",
      "notes",
    ];
    const { data } = await admin
      .from("payments")
      .select(header.join(","))
      .eq("property_id", pid)
      .gte("created_at", since)
      .order("created_at");
    rows = (data ?? []).map((r) =>
      header.map((h) => csvEscape((r as unknown as Record<string, unknown>)[h])),
    );
  }

  return csvResponse(kind, since, header, rows);
}
