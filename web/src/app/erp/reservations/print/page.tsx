import { DeskListShell } from "@/components/erp/DeskListShell";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { normalizeArrivalRange } from "@/lib/erp/reservation-date-range";
import {
  parseReservationStatusBucket,
  statusesForBucket,
} from "@/lib/erp/reservation-status-buckets";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { bookingConfirmationLabel } from "@/lib/booking-ref";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Print · Reservations | Hotel OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function ReservationsPrintPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    bucket?: string;
    source?: string;
    check_in_from?: string;
    check_in_to?: string;
    worklist?: string;
  }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const sp = await searchParams;
  const status = (sp.status ?? "").trim();
  const bucket = parseReservationStatusBucket(sp.bucket);
  const source = (sp.source ?? "").trim();
  const { from: checkInFrom, to: checkInTo } = normalizeArrivalRange(
    sp.check_in_from,
    sp.check_in_to,
  );
  const worklist = (sp.worklist ?? "").trim();

  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  let q = admin
    .from("bookings")
    .select(
      `id, confirmation_code, contact_name, contact_phone, check_in, check_out, status, source, adults, rooms, created_at,
       token_required_btn, token_received_btn, quoted_total_btn,
       agents(company_name),
       room_assignments( room_units(label) )`,
    )
    .eq("property_id", propertyId)
    .order("check_in", { ascending: true })
    .limit(500);

  if (status) q = q.eq("status", status);
  else {
    const statuses = statusesForBucket(bucket);
    if (statuses) q = q.in("status", statuses);
  }
  if (source) q = q.eq("source", source);
  if (checkInFrom) q = q.gte("check_in", checkInFrom);
  if (checkInTo) q = q.lte("check_in", checkInTo);

  const { data: rows } = await q;
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

  return (
    <DeskListShell
      eyebrow="Print"
      heading="Reservation list"
      blurb={`${list.length} row(s)${worklist === "deposit_due" ? " · deposit due" : ""}. Press Ctrl+P (or Cmd+P) to print.`}
      headerAside={
        <Link
          href="/erp/reservations"
          className="text-sm font-medium text-accent underline-offset-4 hover:underline print:hidden"
        >
          ← Back
        </Link>
      }
    >
      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-border text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            <th className="py-2 pr-2">Conf</th>
            <th className="py-2 pr-2">Guest</th>
            <th className="py-2 pr-2">Arrival</th>
            <th className="py-2 pr-2">Departure</th>
            <th className="py-2 pr-2">Rooms</th>
            <th className="py-2 pr-2">Source / agent</th>
            <th className="py-2 pr-2">Status</th>
            <th className="py-2 text-right">Quoted</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => {
            const agent = r.agents as
              | { company_name?: string }
              | { company_name?: string }[]
              | null;
            const agentName = Array.isArray(agent)
              ? agent[0]?.company_name
              : agent?.company_name;
            const assignments =
              (r.room_assignments as
                | Array<{
                    room_units:
                      | { label?: string }
                      | { label?: string }[]
                      | null;
                  }>
                | null) ?? [];
            const labels: string[] = [];
            for (const a of assignments) {
              const ru = a.room_units;
              const unit = Array.isArray(ru) ? ru[0] : ru;
              if (unit?.label) labels.push(unit.label);
            }
            return (
              <tr key={r.id as string} className="border-b border-border/60">
                <td className="py-1.5 pr-2 font-mono">
                  {bookingConfirmationLabel({
                    confirmationCode: r.confirmation_code as string | null,
                    bookingId: r.id as string,
                  })}
                </td>
                <td className="py-1.5 pr-2">
                  {(r.contact_name as string) || "—"}
                  {r.contact_phone ? (
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      {r.contact_phone as string}
                    </span>
                  ) : null}
                </td>
                <td className="py-1.5 pr-2 tabular-nums">{r.check_in as string}</td>
                <td className="py-1.5 pr-2 tabular-nums">
                  {r.check_out as string}
                </td>
                <td className="py-1.5 pr-2">
                  {labels.join(", ") || `×${r.rooms ?? 1}`}
                </td>
                <td className="py-1.5 pr-2">
                  {agentName || (r.source as string) || "—"}
                </td>
                <td className="py-1.5 pr-2 uppercase">
                  {String(r.status ?? "").replace(/_/g, " ")}
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {r.quoted_total_btn != null
                    ? Number(r.quoted_total_btn).toLocaleString("en-BT")
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </DeskListShell>
  );
}
