import { isDeskAuthenticated } from "@/lib/desk-auth";
import { thimphuToday } from "@/lib/erp-lists";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { loadAgentProductionReport } from "@/lib/reports/agent-dossier";
import {
  loadAgentArReport,
  loadCancellationsReport,
  loadDepositDueReport,
  loadFoOccupancyReport,
  loadGuestArAgingReport,
  loadInventoryMovementsSummary,
  loadMealCountReport,
  loadRoomMoveAuditReport,
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
    kind === "agent-commission" ||
    kind === "agent-ar" ||
    kind === "deposit-due" ||
    kind === "cancellations" ||
    kind === "meal-count" ||
    kind === "fo-occupancy" ||
    kind === "room-moves" ||
    kind === "guest-ar-aging" ||
    kind === "staff-attendance" ||
    kind === "staff-sales" ||
    kind === "inventory-movements" ||
    kind === "immigration" ||
    kind === "sdf"
  ) {
    const propertyId = await requireDeskPropertyId();
    const today = thimphuToday();

    if (kind === "immigration" || kind === "sdf") {
      const scope = url.searchParams.get("scope") ?? "in_house";
      let bookingsQuery = admin
        .from("bookings")
        .select(
          `id, contact_name, contact_phone, check_in, check_out, status, guest_origin,
           booking_guests(full_name, nationality, passport_or_cid, sdf_ref),
           room_assignments(room_units(label))`,
        )
        .eq("property_id", propertyId)
        .limit(500);

      if (scope === "arrivals") {
        bookingsQuery = bookingsQuery
          .eq("check_in", today)
          .in("status", ["confirmed", "checked_in", "pending"]);
      } else {
        bookingsQuery = bookingsQuery
          .lte("check_in", today)
          .gt("check_out", today)
          .in("status", ["checked_in", "confirmed"]);
      }

      const { data: bookingRows } = await bookingsQuery;
      const rows: string[][] = [];
      for (const b of bookingRows ?? []) {
        const assigns =
          (b.room_assignments as
            | { room_units?: { label?: string } | { label?: string }[] }[]
            | null) ?? [];
        const rooms = assigns
          .map((a) => {
            const u = Array.isArray(a.room_units) ? a.room_units[0] : a.room_units;
            return u?.label;
          })
          .filter(Boolean)
          .join("; ");
        const guests =
          (b.booking_guests as
            | {
                full_name?: string | null;
                nationality?: string | null;
                passport_or_cid?: string | null;
                sdf_ref?: string | null;
              }[]
            | null) ?? [];
        if (guests.length === 0) {
          rows.push([
            csvEscape(b.id),
            csvEscape(b.contact_name),
            "",
            csvEscape(b.guest_origin),
            "",
            "",
            "1",
            csvEscape(b.check_in),
            csvEscape(b.check_out),
            csvEscape(b.status),
            csvEscape(rooms),
            csvEscape(b.contact_phone),
          ]);
          continue;
        }
        for (const g of guests) {
          const incomplete =
            !String(g.passport_or_cid ?? "").trim() ||
            !String(g.sdf_ref ?? "").trim()
              ? "1"
              : "0";
          rows.push([
            csvEscape(b.id),
            csvEscape(g.full_name || b.contact_name),
            csvEscape(g.nationality),
            csvEscape(b.guest_origin),
            csvEscape(g.passport_or_cid),
            csvEscape(g.sdf_ref),
            incomplete,
            csvEscape(b.check_in),
            csvEscape(b.check_out),
            csvEscape(b.status),
            csvEscape(rooms),
            csvEscape(b.contact_phone),
          ]);
        }
      }
      return csvResponse(
        "immigration",
        today,
        [
          "booking_id",
          "guest_name",
          "nationality",
          "guest_origin",
          "passport_or_cid",
          "sdf_ref",
          "passport_sdf_incomplete",
          "check_in",
          "check_out",
          "status",
          "rooms",
          "contact_phone",
        ],
        rows,
      );
    }

    if (kind === "agent-production" || kind === "agent-commission") {
      const rows = await loadAgentProductionReport(admin, {
        propertyId,
        from: since,
        to: until,
        agentId,
      });
      if (kind === "agent-commission") {
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
            "commission_pct",
            "commission_btn",
          ],
          rows.map((r) => [
            csvEscape(r.agent_id),
            csvEscape(r.company_name),
            csvEscape(r.bookings),
            csvEscape(r.rooms),
            csvEscape(r.room_nights),
            csvEscape(r.quoted_total),
            csvEscape(r.commission_pct ?? ""),
            csvEscape(r.commission_btn ?? 0),
          ]),
        );
      }
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
          "commission_pct",
          "commission_btn",
        ],
        rows.map((r) => [
          csvEscape(r.agent_id),
          csvEscape(r.company_name),
          csvEscape(r.bookings),
          csvEscape(r.rooms),
          csvEscape(r.room_nights),
          csvEscape(r.quoted_total),
          csvEscape(r.commission_pct ?? ""),
          csvEscape(r.commission_btn ?? 0),
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

    if (kind === "deposit-due") {
      const rows = await loadDepositDueReport(admin, {
        propertyId,
        from: since,
        to: until,
      });
      return csvResponse(
        kind,
        since,
        [
          "booking_id",
          "confirmation_code",
          "contact_name",
          "check_in",
          "status",
          "token_required",
          "token_received",
          "shortfall",
          "deposit_due_on",
          "agent_name",
        ],
        rows.map((r) => [
          csvEscape(r.booking_id),
          csvEscape(r.confirmation_code ?? ""),
          csvEscape(r.contact_name),
          csvEscape(r.check_in),
          csvEscape(r.status),
          csvEscape(r.token_required_btn),
          csvEscape(r.token_received_btn),
          csvEscape(r.shortfall_btn),
          csvEscape(r.deposit_due_on ?? ""),
          csvEscape(r.agent_name ?? ""),
        ]),
      );
    }

    if (kind === "cancellations") {
      const rows = await loadCancellationsReport(admin, {
        propertyId,
        from: since,
        to: until,
      });
      return csvResponse(
        kind,
        since,
        [
          "booking_id",
          "confirmation_code",
          "contact_name",
          "check_in",
          "check_out",
          "status",
          "quoted_total",
          "agent_name",
        ],
        rows.map((r) => [
          csvEscape(r.booking_id),
          csvEscape(r.confirmation_code ?? ""),
          csvEscape(r.contact_name),
          csvEscape(r.check_in),
          csvEscape(r.check_out),
          csvEscape(r.status),
          csvEscape(r.quoted_total_btn),
          csvEscape(r.agent_name ?? ""),
        ]),
      );
    }

    if (kind === "meal-count") {
      const report = await loadMealCountReport(admin, {
        propertyId,
        businessDate: until,
      });
      return csvResponse(
        kind,
        until,
        [
          "guest",
          "rooms",
          "meal_plan",
          "pax",
          "breakfast",
          "lunch",
          "dinner",
          "status",
          "booking_id",
        ],
        report.rows.map((r) => [
          csvEscape(r.guest_name),
          csvEscape(r.rooms),
          csvEscape(r.meal_plan),
          csvEscape(r.pax),
          csvEscape(r.breakfast ? "1" : "0"),
          csvEscape(r.lunch ? "1" : "0"),
          csvEscape(r.dinner ? "1" : "0"),
          csvEscape(r.status),
          csvEscape(r.booking_id),
        ]),
      );
    }

    if (kind === "fo-occupancy") {
      const rows = await loadFoOccupancyReport(admin, {
        propertyId,
        from: since,
        to: until,
      });
      return csvResponse(
        kind,
        since,
        [
          "date",
          "sellable_capacity",
          "rooms_occupied",
          "rooms_comp",
          "occupancy_pct",
          "arrivals",
          "departures",
        ],
        rows.map((r) => [
          csvEscape(r.date),
          csvEscape(r.sellable_capacity),
          csvEscape(r.rooms_occupied),
          csvEscape(r.rooms_comp),
          csvEscape(r.occupancy_pct),
          csvEscape(r.arrivals),
          csvEscape(r.departures),
        ]),
      );
    }

    if (kind === "room-moves") {
      const rows = await loadRoomMoveAuditReport(admin, {
        propertyId,
        from: since,
        to: until,
      });
      return csvResponse(
        kind,
        since,
        ["at", "actor", "summary", "booking_id", "assignment_id", "action"],
        rows.map((r) => [
          csvEscape(r.at),
          csvEscape(r.actor),
          csvEscape(r.summary),
          csvEscape(r.booking_id ?? ""),
          csvEscape(r.assignment_id ?? ""),
          csvEscape(r.action),
        ]),
      );
    }

    if (kind === "guest-ar-aging") {
      const { rows } = await loadGuestArAgingReport(admin, {
        propertyId,
        asOf: until,
      });
      return csvResponse(
        kind,
        until,
        [
          "folio_id",
          "booking_id",
          "contact_name",
          "check_out",
          "status",
          "balance",
          "current",
          "d30",
          "d60",
          "d90",
          "agent_name",
        ],
        rows.map((r) => [
          csvEscape(r.folio_id),
          csvEscape(r.booking_id),
          csvEscape(r.contact_name),
          csvEscape(r.check_out),
          csvEscape(r.status),
          csvEscape(r.balance_btn),
          csvEscape(r.aging_current),
          csvEscape(r.aging_d30),
          csvEscape(r.aging_d60),
          csvEscape(r.aging_d90),
          csvEscape(r.agent_name ?? ""),
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

    if (kind === "staff-sales") {
      const { loadStaffSalesReport } = await import("@/lib/reports/catalog");
      const rows = await loadStaffSalesReport(admin, {
        propertyId,
        from: since,
        to: until,
        staffId,
        status: "approved",
      });
      return csvResponse(
        kind,
        since,
        [
          "booking_id",
          "staff_id",
          "staff_name",
          "contact_name",
          "check_in",
          "check_out",
          "agent_name",
          "quoted_total_btn",
          "commission_pct",
          "commission_btn",
          "sales_claim_status",
        ],
        rows.map((r) => [
          csvEscape(r.booking_id),
          csvEscape(r.staff_id),
          csvEscape(r.staff_name),
          csvEscape(r.contact_name),
          csvEscape(r.check_in),
          csvEscape(r.check_out),
          csvEscape(r.agent_name),
          csvEscape(r.quoted_total_btn),
          csvEscape(r.commission_pct ?? ""),
          csvEscape(r.commission_btn),
          csvEscape(r.sales_claim_status),
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
