import { isDeskAuthenticated } from "@/lib/desk-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function csvEscape(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Accounting export: payments + expenses + folio lines (month-to-date). */
export async function GET(request: Request) {
  if (!(await isDeskAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? "payments";
  const since =
    url.searchParams.get("since") ??
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;

  const admin = createSupabaseAdminClient();
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
    rows = (data ?? []).map((r) => header.map((h) => csvEscape((r as unknown as Record<string, unknown>)[h])));
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
      const lines =
        (f.folio_lines as Record<string, unknown>[] | null) ?? [];
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
    rows = (data ?? []).map((r) => header.map((h) => csvEscape((r as unknown as Record<string, unknown>)[h])));
  }

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
