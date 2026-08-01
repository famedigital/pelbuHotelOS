import { NightAuditForm } from "@/components/erp/NightAuditForm";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { thimphuToday } from "@/lib/erp-lists";
import { formatBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Night audit | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ErpNightAuditPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const today = thimphuToday();
  const [{ data: audits }, { data: shifts }] = await Promise.all([
    admin
      .from("night_audits")
      .select(
        "id, business_date, rooms_occupied, rooms_comp, folio_charges_btn, folio_payments_btn, open_folios, notes, summary, created_at",
      )
      .eq("property_id", propertyId)
      .order("business_date", { ascending: false })
      .limit(30),
    admin
      .from("pos_shifts")
      .select(
        "id, business_date, status, opening_float_btn, expected_cash_btn, counted_cash_btn, variance_btn, tender_totals, void_total_btn, opened_by_name, closed_by_name, opened_at, closed_at",
      )
      .eq("property_id", propertyId)
      .order("opened_at", { ascending: false })
      .limit(60),
  ]);

  const zByDate = new Map<
    string,
    {
      shiftCount: number;
      openCount: number;
      sales: number;
      cash: number;
      variance: number;
      voids: number;
    }
  >();
  for (const shift of shifts ?? []) {
    const date = shift.business_date as string;
    const totals = (shift.tender_totals ?? {}) as Record<string, unknown>;
    const current = zByDate.get(date) ?? {
      shiftCount: 0,
      openCount: 0,
      sales: 0,
      cash: 0,
      variance: 0,
      voids: 0,
    };
    current.shiftCount += shift.status === "closed" ? 1 : 0;
    current.openCount += shift.status === "open" ? 1 : 0;
    for (const value of Object.values(totals)) {
      current.sales += Number(value ?? 0);
    }
    current.cash += Number(totals.cash ?? 0);
    current.variance += Number(shift.variance_btn ?? 0);
    current.voids += Number(shift.void_total_btn ?? 0);
    zByDate.set(date, current);
  }

  return (
    <div className="erp mx-auto w-full max-w-[1200px] space-y-10 p-4 md:p-6">
      <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
        <NightAuditForm defaultDate={today} />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
              History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(audits ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No night audits yet.
              </p>
            ) : (
              <ul className="divide-y">
                {(audits ?? []).map((a) => {
                  const summary = (a.summary ?? {}) as {
                    room_nights_posted?: number;
                    room_nights_skipped?: number;
                    room_night_errors?: string[];
                  };
                  const posted = summary.room_nights_posted ?? 0;
                  const skipped = summary.room_nights_skipped ?? 0;
                  return (
                  <li key={a.id as string} className="py-4 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-medium text-foreground">
                        {a.business_date as string}
                      </p>
                      <div className="flex flex-wrap items-center gap-3">
                        <a
                          href={`/api/erp/night-audit/continuity?date=${encodeURIComponent(a.business_date as string)}`}
                          className="text-xs font-medium text-accent underline-offset-4 hover:underline"
                          download
                        >
                          Download backup
                        </a>
                        <Link
                          href={`/erp/night-audit/${a.id as string}/print`}
                          className="text-xs font-medium text-accent underline-offset-4 hover:underline"
                        >
                          Print pack →
                        </Link>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Sellable {a.rooms_occupied as number} · Comp {a.rooms_comp as number}{" "}
                      · Open folios {a.open_folios as number}
                    </p>
                    <p className="mt-1 text-xs tabular-nums text-foreground">
                      Charges {formatBtn(Number(a.folio_charges_btn))} · Payments{" "}
                      {formatBtn(Number(a.folio_payments_btn))}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Room nights: {posted} posted
                      {skipped > 0 ? ` · ${skipped} skipped (already posted)` : ""}
                    </p>
                    {a.notes ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {a.notes as string}
                      </p>
                    ) : null}
                  </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
            POS daily Z-reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          {zByDate.size === 0 ? (
            <p className="text-sm text-muted-foreground">
              Z-reports appear after the first POS shift is opened.
            </p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[...zByDate.entries()].map(([date, z]) => (
                <li key={date} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{date}</p>
                    <span className="text-xs text-muted-foreground">
                      {z.shiftCount} closed
                      {z.openCount ? ` · ${z.openCount} open` : ""}
                    </span>
                  </div>
                  <p className="mt-3 text-2xl font-semibold tabular-nums">
                    {formatBtn(z.sales)}
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Cash sales</p>
                      <p className="mt-0.5 font-medium tabular-nums">
                        {formatBtn(z.cash)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Variance</p>
                      <p className="mt-0.5 font-medium tabular-nums">
                        {formatBtn(z.variance)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Voids</p>
                      <p className="mt-0.5 font-medium tabular-nums">
                        {formatBtn(z.voids)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
