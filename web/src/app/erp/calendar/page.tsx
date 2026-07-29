import { DeskListShell } from "@/components/erp/DeskListShell";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { fmtDate, requireDeskPropertyId, thimphuToday } from "@/lib/erp-lists";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Calendar | Pelbu OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default async function CalendarPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const start = thimphuToday();
  const days = Array.from({ length: 14 }, (_, i) => addDays(start, i));
  const end = days[days.length - 1];

  const [{ data: units }, { data: bookings }] = await Promise.all([
    admin
      .from("room_units")
      .select("id, label, hk_status, room_types(code, name)")
      .eq("property_id", propertyId)
      .order("label")
      .limit(80),
    admin
      .from("bookings")
      .select("id, contact_name, check_in, check_out, status, rooms")
      .eq("property_id", propertyId)
      .lt("check_in", addDays(end, 1))
      .gt("check_out", start)
      .in("status", ["held", "pending", "confirmed", "checked_in"])
      .limit(200),
  ]);

  const occupancyByDay = days.map((day) => {
    let rooms = 0;
    for (const b of bookings ?? []) {
      const ci = b.check_in as string;
      const co = b.check_out as string;
      if (ci <= day && day < co) rooms += Number(b.rooms ?? 0);
    }
    return { day, rooms };
  });

  return (
    <DeskListShell
      title="Calendar"
      eyebrow="Room rack"
      heading="14-day occupancy"
      blurb="Sellable rooms currently reserved or in-house by night. Physical unit HK status below."
    >
      <div className="overflow-x-auto rounded-sm border border-espresso/10 bg-white p-4">
        <div className="flex min-w-[720px] gap-1">
          {occupancyByDay.map(({ day, rooms }) => (
            <div
              key={day}
              className="flex w-14 flex-col items-center gap-2 border border-espresso/10 px-1 py-3"
            >
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {fmtDate(day).split(" ").slice(0, 2).join(" ")}
              </span>
              <span className="text-lg font-medium tabular-nums text-espresso">{rooms}</span>
              <span className="text-[10px] text-muted-foreground">rms</span>
            </div>
          ))}
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
          Physical units
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(units ?? []).map((u) => {
            const rt = u.room_types as
              | { code?: string; name?: string }
              | { code?: string; name?: string }[]
              | null;
            const type = Array.isArray(rt) ? rt[0] : rt;
            return (
              <li
                key={u.id as string}
                className="flex items-center justify-between border border-espresso/10 bg-white px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-espresso">{u.label as string}</p>
                  <p className="text-xs text-muted-foreground">
                    {type?.name ?? type?.code ?? "Room"}
                  </p>
                </div>
                <span className="text-[10px] uppercase tracking-wide text-gold">
                  {u.hk_status as string}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
          Active stays in window
        </h2>
        <ul className="divide-y divide-espresso/10 border border-espresso/10 bg-white">
          {(bookings ?? []).map((b) => (
            <li key={b.id as string} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-espresso">
                  {(b.contact_name as string) ?? "Guest"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {fmtDate(b.check_in as string)} → {fmtDate(b.check_out as string)} Â·{" "}
                  {b.status as string}
                </p>
              </div>
              <a
                href={`/erp/check-in?booking=${b.id as string}`}
                className="text-maroon underline-offset-4 hover:underline"
              >
                Open →
              </a>
            </li>
          ))}
        </ul>
      </section>
    </DeskListShell>
  );
}
