import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import {
  confirmedAgentsCsv,
  loadConfirmedAgentsContactList,
} from "@/lib/erp/confirmed-agents";
import { thimphuToday } from "@/lib/erp-lists";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

function addMonths(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

function addDaysExclusive(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  if (!(await isDeskAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const today = thimphuToday();
  const fromRaw = url.searchParams.get("from");
  const toRaw = url.searchParams.get("to");
  const from =
    fromRaw && /^\d{4}-\d{2}-\d{2}$/.test(fromRaw) ? fromRaw : today;
  const to =
    toRaw && /^\d{4}-\d{2}-\d{2}$/.test(toRaw) ? toRaw : addMonths(today, 6);
  const includeCheckedIn = url.searchParams.get("mode") !== "confirmed_only";
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();

  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  let rows = await loadConfirmedAgentsContactList(admin, {
    propertyId,
    from,
    to: addDaysExclusive(to),
    includeCheckedIn,
  });
  if (q) {
    rows = rows.filter((r) => {
      const hay = [
        r.company_name,
        r.contact_name,
        r.contact_phone,
        r.contact_email,
        r.market,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  const body = confirmedAgentsCsv(rows);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="confirmed-agents-${from}_${to}.csv"`,
    },
  });
}
