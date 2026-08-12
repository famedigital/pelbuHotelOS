import { isDeskAuthenticated } from "@/lib/desk-auth";
import {
  parseReservationStatusBucket,
  statusesForBucket,
} from "@/lib/erp/reservation-status-buckets";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** CSV export of reservations (eZee Excel export lite). */
export async function GET(req: Request) {
  if (!(await isDeskAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const status = (url.searchParams.get("status") ?? "").trim();
  const bucket = parseReservationStatusBucket(url.searchParams.get("bucket"));
  const source = (url.searchParams.get("source") ?? "").trim();
  const checkInFrom = url.searchParams.get("check_in_from") ?? "";
  const checkInTo = url.searchParams.get("check_in_to") ?? "";
  const worklist = (url.searchParams.get("worklist") ?? "").trim();

  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  let q = admin
    .from("bookings")
    .select(
      `confirmation_code, contact_name, contact_phone, check_in, check_out, status, source, adults, rooms, created_at,
       token_required_btn, token_received_btn, deposit_due_on, hold_expires_at, quoted_total_btn,
       agents(company_name),
       room_assignments( room_units(label) )`,
    )
    .eq("property_id", propertyId)
    .order("check_in", { ascending: true })
    .limit(2000);

  if (status) {
    q = q.eq("status", status);
  } else {
    const statuses = statusesForBucket(bucket);
    if (statuses) q = q.in("status", statuses);
  }
  if (source) q = q.eq("source", source);
  const fromOk = checkInFrom && ISO.test(checkInFrom) ? checkInFrom : "";
  const toOk = checkInTo && ISO.test(checkInTo) ? checkInTo : "";
  let from = fromOk;
  let to = toOk;
  if (from && to && from > to) {
    const swap = from;
    from = to;
    to = swap;
  }
  if (from) q = q.gte("check_in", from);
  if (to) q = q.lte("check_in", to);

  const { data: rows, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let list = rows ?? [];
  if (worklist === "deposit_due") {
    list = list.filter((r) => {
      const st = r.status as string;
      if (!["held", "pending", "confirmed"].includes(st)) return false;
      const req = Number(r.token_required_btn ?? 0);
      const got = Number(r.token_received_btn ?? 0);
      return req > 0 && got + 0.009 < req;
    });
  }

  const header = [
    "conf",
    "guest",
    "phone",
    "check_in",
    "check_out",
    "status",
    "source",
    "agent",
    "rooms",
    "room_labels",
    "adults",
    "token_required",
    "token_received",
    "quoted_total",
    "deposit_due_on",
    "created_at",
  ];

  const lines = [header.join(",")];
  for (const r of list) {
    const agent = r.agents as
      | { company_name?: string }
      | { company_name?: string }[]
      | null;
    const agentName = Array.isArray(agent)
      ? (agent[0]?.company_name ?? "")
      : (agent?.company_name ?? "");
    const assignments =
      (r.room_assignments as
        | Array<{ room_units: { label?: string } | { label?: string }[] | null }>
        | null) ?? [];
    const labels: string[] = [];
    for (const a of assignments) {
      const ru = a.room_units;
      const unit = Array.isArray(ru) ? ru[0] : ru;
      if (unit?.label) labels.push(unit.label);
    }
    const cells = [
      r.confirmation_code,
      r.contact_name,
      r.contact_phone,
      r.check_in,
      r.check_out,
      r.status,
      r.source,
      agentName,
      r.rooms,
      labels.join("; "),
      r.adults,
      r.token_required_btn,
      r.token_received_btn,
      r.quoted_total_btn,
      r.deposit_due_on,
      r.created_at,
    ].map(csvEscape);
    lines.push(cells.join(","));
  }

  const body = `${lines.join("\r\n")}\r\n`;
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pelbu-reservations-${day}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
