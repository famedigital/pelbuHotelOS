import { PrintButton } from "@/components/erp/PrintButton";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { formatBtn } from "@/lib/pricing";
import { loadProperty } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const metadata = {
  title: "Night audit print",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function NightAuditPrintPage({ params }: Props) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const property = await loadProperty(admin, propertyId);

  const { data: audit } = await admin
    .from("night_audits")
    .select(
      "id, business_date, rooms_occupied, rooms_comp, folio_charges_btn, folio_payments_btn, open_folios, notes, summary, created_at",
    )
    .eq("id", id)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (!audit) notFound();

  const businessDate = audit.business_date as string;
  const summary = (audit.summary ?? {}) as {
    room_nights_posted?: number;
    room_nights_skipped?: number;
    room_night_errors?: string[];
  };

  const [{ data: shifts }, { data: units }, { data: departures }] =
    await Promise.all([
      admin
        .from("pos_shifts")
        .select(
          "id, status, opening_float_btn, expected_cash_btn, counted_cash_btn, variance_btn, tender_totals, void_total_btn, opened_by_name, closed_by_name",
        )
        .eq("property_id", propertyId)
        .eq("business_date", businessDate)
        .limit(20),
      admin
        .from("room_units")
        .select("id, label, hk_status")
        .eq("property_id", propertyId)
        .limit(200),
      admin
        .from("bookings")
        .select("id, contact_name, status, check_out, room_assignments(room_units(label))")
        .eq("property_id", propertyId)
        .eq("check_out", businessDate)
        .in("status", ["checked_in", "checked_out"])
        .limit(100),
    ]);

  const hk: Record<string, number> = {};
  for (const u of units ?? []) {
    const st = (u.hk_status as string) || "unknown";
    hk[st] = (hk[st] ?? 0) + 1;
  }

  let posSales = 0;
  let posCash = 0;
  let posVariance = 0;
  let posVoids = 0;
  for (const shift of shifts ?? []) {
    const totals = (shift.tender_totals ?? {}) as Record<string, unknown>;
    for (const value of Object.values(totals)) {
      posSales += Number(value ?? 0);
    }
    posCash += Number(totals.cash ?? 0);
    posVariance += Number(shift.variance_btn ?? 0);
    posVoids += Number(shift.void_total_btn ?? 0);
  }

  const stillIn =
    (departures ?? []).filter((d) => d.status === "checked_in") ?? [];

  return (
    <div className="erp mx-auto max-w-3xl space-y-6 p-4 md:p-6 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
            Night audit pack
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {businessDate}
          </h1>
          <p className="text-sm text-muted-foreground">
            {property?.name ?? "Property"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/erp/night-audit"
            className="inline-flex h-9 items-center rounded-md border px-3 text-sm"
          >
            ← History
          </Link>
          <PrintButton label="Print pack" />
        </div>
      </div>

      <div className="hidden print:block">
        <h1 className="text-xl font-semibold">
          {property?.name ?? "Hotel"} · Night audit {businessDate}
        </h1>
        <p className="text-sm text-muted-foreground">
          Closed {String(audit.created_at).slice(0, 16).replace("T", " ")}
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 print:break-inside-avoid">
        {[
          ["Sellable occupied", String(audit.rooms_occupied ?? 0)],
          ["Comp occupied", String(audit.rooms_comp ?? 0)],
          ["Open folios", String(audit.open_folios ?? 0)],
          ["Charges", formatBtn(Number(audit.folio_charges_btn))],
          ["Payments", formatBtn(Number(audit.folio_payments_btn))],
          [
            "Room nights posted",
            String(summary.room_nights_posted ?? 0),
          ],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-card px-4 py-3">
            <p className="text-[10px] font-semibold tracking-[0.16em] text-accent uppercase">
              {label}
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </section>

      {audit.notes ? (
        <p className="text-sm text-muted-foreground">Notes: {audit.notes as string}</p>
      ) : null}

      {(summary.room_night_errors?.length ?? 0) > 0 ? (
        <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <h2 className="text-sm font-semibold text-destructive">
            Room-night errors
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {(summary.room_night_errors ?? []).map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-lg border bg-card p-4 print:break-inside-avoid">
        <h2 className="text-sm font-semibold">POS Z for business date</h2>
        {(shifts ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No POS shifts.</p>
        ) : (
          <>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Sales</p>
                <p className="font-medium tabular-nums">{formatBtn(posSales)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cash</p>
                <p className="font-medium tabular-nums">{formatBtn(posCash)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Variance</p>
                <p
                  className={`font-medium tabular-nums ${
                    Math.abs(posVariance) > 0.009
                      ? "text-amber-700 dark:text-amber-300"
                      : ""
                  }`}
                >
                  {formatBtn(posVariance)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Voids</p>
                <p className="font-medium tabular-nums">{formatBtn(posVoids)}</p>
              </div>
            </div>
            <table className="mt-4 w-full text-left text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-1.5 pr-2 font-medium">Shift</th>
                  <th className="py-1.5 pr-2 font-medium">Status</th>
                  <th className="py-1.5 pr-2 font-medium text-right">Expected</th>
                  <th className="py-1.5 pr-2 font-medium text-right">Counted</th>
                  <th className="py-1.5 font-medium text-right">Variance</th>
                </tr>
              </thead>
              <tbody>
                {(shifts ?? []).map((shift) => (
                  <tr key={shift.id as string} className="border-b border-border/60">
                    <td className="py-1.5 pr-2">
                      {(shift.opened_by_name as string) ||
                        String(shift.id).slice(0, 8)}
                      {shift.closed_by_name
                        ? ` → ${shift.closed_by_name as string}`
                        : ""}
                    </td>
                    <td className="py-1.5 pr-2 capitalize">
                      {String(shift.status ?? "—")}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">
                      {formatBtn(Number(shift.expected_cash_btn ?? 0))}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">
                      {formatBtn(Number(shift.counted_cash_btn ?? 0))}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {formatBtn(Number(shift.variance_btn ?? 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      <section className="rounded-lg border bg-card p-4 print:break-inside-avoid">
        <h2 className="text-sm font-semibold">Housekeeping snapshot</h2>
        <p className="mt-2 text-sm">
          {Object.entries(hk)
            .map(([k, v]) => `${k} ${v}`)
            .join(" · ") || "n/a"}
        </p>
      </section>

      <section className="rounded-lg border bg-card p-4 print:break-inside-avoid">
        <h2 className="text-sm font-semibold">
          Departures due ({(departures ?? []).length})
          {stillIn.length > 0
            ? ` · ${stillIn.length} still checked in`
            : ""}
        </h2>
        {(departures ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">None.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {(departures ?? []).map((d) => {
              const assigns =
                (d.room_assignments as
                  | { room_units?: { label?: string } | { label?: string }[] }[]
                  | null) ?? [];
              const rooms = assigns
                .map((a) => {
                  const u = Array.isArray(a.room_units)
                    ? a.room_units[0]
                    : a.room_units;
                  return u?.label;
                })
                .filter(Boolean)
                .join(", ");
              return (
                <li key={d.id as string}>
                  {(d.contact_name as string) ?? "Guest"}
                  {rooms ? ` · ${rooms}` : ""} · {d.status as string}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
