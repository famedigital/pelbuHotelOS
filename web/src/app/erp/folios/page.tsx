import { DeskListShell } from "@/components/erp/DeskListShell";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId, thimphuToday } from "@/lib/erp-lists";
import { netFolioBalance } from "@/lib/folio/balance";
import { formatBtn } from "@/lib/pricing";
import { addToAging, emptyAging } from "@/lib/reports/ar-aging";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "City ledger | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Master / city-ledger folios for group settle and agent AR. */
export default async function CityLedgerPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const today = thimphuToday();

  const { data: masters } = await admin
    .from("folios")
    .select(
      "id, label, status, booking_id, created_at, folio_lines(id, total_btn, status, reverses_line_id)",
    )
    .eq("property_id", propertyId)
    .eq("folio_type", "master")
    .order("created_at", { ascending: false })
    .limit(80);

  let aging = emptyAging();
  const rows = (masters ?? []).map((f) => {
    const lines =
      (f.folio_lines as
        | {
            id: string;
            total_btn: number;
            status: string;
            reverses_line_id?: string | null;
          }[]
        | null) ?? [];
    const balance = netFolioBalance(lines);
    const openDate = String(f.created_at).slice(0, 10);
    if (Math.abs(balance) > 0.009 && (f.status as string) !== "settled") {
      aging = addToAging(aging, balance, today, openDate);
    }
    return {
      id: f.id as string,
      label: (f.label as string) || (f.id as string).slice(0, 8),
      status: f.status as string,
      bookingId: (f.booking_id as string | null) ?? null,
      balance,
      createdAt: f.created_at as string,
      openDate,
    };
  });

  return (
    <DeskListShell
      eyebrow="Money"
      heading="City ledger"
      blurb="Master folios for groups and agent city ledger. AR aging 30/60/90 below."
    >
      <section className="rounded-lg border bg-card p-4">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
          AR aging (open master balances · as of {today})
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          {[
            ["0–30", aging.current],
            ["31–60", aging.d30],
            ["61–90", aging.d60],
            ["90+", aging.d90],
          ].map(([label, val]) => (
            <div key={String(label)}>
              <p className="text-xs text-muted-foreground">{label} days</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {formatBtn(Number(val))}
              </p>
            </div>
          ))}
        </div>
      </section>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No master folios yet. Open a guest folio and choose{" "}
          <strong className="font-medium text-foreground">Make master folio</strong>.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <Link
                  href={`/erp/folios/${r.id}`}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {r.label}
                </Link>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  <span className="uppercase tracking-wide">{r.status}</span>
                  {" · opened "}
                  {r.openDate}
                  {r.bookingId ? (
                    <>
                      {" · "}
                      <span className="font-mono">{r.bookingId.slice(0, 8)}</span>
                    </>
                  ) : null}
                  {" · "}
                  <Link
                    href={`/erp/folios/${r.id}/statement`}
                    className="underline-offset-2 hover:underline"
                  >
                    AR statement
                  </Link>
                </p>
              </div>
              <p
                className={`tabular-nums font-medium ${
                  Math.abs(r.balance) > 0.01 ? "text-destructive" : "text-foreground"
                }`}
              >
                {formatBtn(r.balance)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </DeskListShell>
  );
}
