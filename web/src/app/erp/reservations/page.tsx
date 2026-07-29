import {
  DeskListShell,
  DeskSearchForm,
  DeskTable,
  StatusPill,
} from "@/components/erp/DeskListShell";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { fmtDate, matchesQuery, requireDeskPropertyId } from "@/lib/erp-lists";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Reservations | Pelbu OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const STATUSES = [
  "",
  "held",
  "pending",
  "confirmed",
  "checked_in",
  "checked_out",
  "cancelled",
  "no_show",
] as const;

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; source?: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const { q, status, source } = await searchParams;
  const query = (q ?? "").trim();
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  let req = admin
    .from("bookings")
    .select(
      "id, contact_name, contact_phone, check_in, check_out, status, source, guest_origin, agent_id, adults, rooms, hold_expires_at, agents(company_name)",
    )
    .eq("property_id", propertyId)
    .order("check_in", { ascending: false })
    .limit(250);

  if (status) req = req.eq("status", status);
  if (source) req = req.eq("source", source);

  const { data: rows } = await req;

  const filtered = (rows ?? []).filter((r) => {
    const agent = r.agents as { company_name?: string } | { company_name?: string }[] | null;
    const agentName = Array.isArray(agent)
      ? agent[0]?.company_name
      : agent?.company_name;
    return matchesQuery(
      [
        r.contact_name as string,
        r.contact_phone as string,
        r.id as string,
        r.source as string,
        agentName,
      ],
      query,
    );
  });

  return (
    <DeskListShell
      title="Reservations"
      eyebrow="Bookings"
      heading="All reservations"
      blurb="Filter by status and source. Open a row to check in or view the folio from Inbox."
      filters={
        <DeskSearchForm
          action="/erp/reservations"
          q={q}
          placeholder="Guest, phone, agent, booking id…"
        >
          <label className="block text-sm text-espresso">
            <span className="sr-only">Status</span>
            <select
              name="status"
              defaultValue={status ?? ""}
              className="min-h-11 rounded-sm border border-espresso/15 bg-white px-3 text-sm"
            >
              <option value="">All statuses</option>
              {STATUSES.filter(Boolean).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-espresso">
            <span className="sr-only">Source</span>
            <input
              name="source"
              defaultValue={source ?? ""}
              placeholder="Source"
              className="min-h-11 w-32 rounded-sm border border-espresso/15 bg-white px-3 text-sm"
            />
          </label>
        </DeskSearchForm>
      }
    >
      <p className="text-xs text-muted-foreground">{filtered.length} shown</p>
      <DeskTable
        caption="Reservations"
        headers={["Guest", "Dates", "Source / agent", "Rooms", "Status", ""]}
      >
        {filtered.length === 0 ? (
          <tr>
            <td colSpan={6} className="px-3 py-6 text-muted-foreground">
              No reservations match.
            </td>
          </tr>
        ) : (
          filtered.map((r) => {
            const agent = r.agents as
              | { company_name?: string }
              | { company_name?: string }[]
              | null;
            const agentName = Array.isArray(agent)
              ? agent[0]?.company_name
              : agent?.company_name;
            return (
              <tr key={r.id as string} className="border-t border-espresso/10">
                <td className="px-3 py-2.5">
                  <p className="font-medium text-espresso">
                    {(r.contact_name as string) ?? "Guest"}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {(r.id as string).slice(0, 8)} Â· {r.contact_phone as string}
                  </p>
                </td>
                <td className="px-3 py-2.5 text-sm">
                  {fmtDate(r.check_in as string)} → {fmtDate(r.check_out as string)}
                </td>
                <td className="px-3 py-2.5 text-sm text-muted-foreground">
                  <span className="text-espresso">{(r.source as string) ?? "—"}</span>
                  {agentName ? <span className="block">{agentName}</span> : null}
                </td>
                <td className="px-3 py-2.5 tabular-nums">
                  {Number(r.rooms ?? 0)} / {Number(r.adults ?? 0)} pax
                </td>
                <td className="px-3 py-2.5">
                  <StatusPill value={r.status as string} />
                </td>
                <td className="px-3 py-2.5 text-right">
                  <a
                    href={`/erp/check-in?booking=${r.id as string}`}
                    className="text-sm text-maroon underline-offset-4 hover:underline"
                  >
                    Open →
                  </a>
                </td>
              </tr>
            );
          })
        )}
      </DeskTable>
    </DeskListShell>
  );
}
