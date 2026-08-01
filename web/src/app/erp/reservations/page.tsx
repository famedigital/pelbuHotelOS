import type { BookingRow } from "@/components/erp/BookingsTable";
import { DeskListShell } from "@/components/erp/DeskListShell";
import { ReservationsAccordionTable } from "@/components/erp/ReservationsAccordionTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { matchesQuery, requireDeskPropertyId } from "@/lib/erp-lists";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const metadata = {
  title: "Reservations | Pelbu OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const STATUSES = [
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

  const data: BookingRow[] = (rows ?? []).map((r) => {
    const agent = r.agents as
      | { company_name?: string }
      | { company_name?: string }[]
      | null;
    const agentName = Array.isArray(agent)
      ? agent[0]?.company_name ?? null
      : agent?.company_name ?? null;
    return {
      id: r.id as string,
      contact_name: (r.contact_name as string) ?? null,
      contact_phone: (r.contact_phone as string) ?? null,
      check_in: (r.check_in as string) ?? null,
      check_out: (r.check_out as string) ?? null,
      source: (r.source as string) ?? null,
      agent_name: agentName,
      adults: (r.adults as number) ?? null,
      rooms: (r.rooms as number) ?? null,
      status: (r.status as string) ?? null,
    };
  });

  const filtered = data.filter((r) =>
    matchesQuery(
      [r.contact_name, r.contact_phone, r.id, r.source, r.agent_name],
      query,
    ),
  );

  return (
    <DeskListShell
      eyebrow="Bookings"
      heading="All reservations"
      blurb="Filter by status and source. Click a row to expand stay details, folio, and lifecycle actions."
      filters={
        <form
          className="flex flex-wrap items-end gap-2"
          action="/erp/reservations"
          method="get"
        >
          <div className="min-w-[220px] flex-1 space-y-1.5">
            <label htmlFor="q" className="sr-only">
              Search
            </label>
            <Input
              id="q"
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Guest, phone, agent, booking id…"
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="status" className="sr-only">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={status ?? ""}
              className="h-10 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="w-32 space-y-1.5">
            <label htmlFor="source" className="sr-only">
              Source
            </label>
            <Input
              id="source"
              name="source"
              defaultValue={source ?? ""}
              placeholder="Source"
              className="h-10"
            />
          </div>
          <Button type="submit" variant="outline" className="h-10">
            Search
          </Button>
        </form>
      }
    >
      <p className="text-xs text-muted-foreground">{filtered.length} shown</p>
      <Suspense
        fallback={
          <p className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
            Loading reservations…
          </p>
        }
      >
        <ReservationsAccordionTable
          data={filtered}
          emptyMessage="No reservations match."
        />
      </Suspense>
    </DeskListShell>
  );
}
