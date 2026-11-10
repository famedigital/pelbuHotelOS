import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { formatBtn } from "@/lib/pricing-catalog";
import { loadCommissionLedger } from "@/lib/platform/admin-data";
import { RecordCommissionForm } from "@/components/platform/RecordCommissionForm";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "OTA Commissions",
  robots: { index: false, follow: false },
};

const DEFAULT_RATES = [
  { market: "local", rate: "3%", note: "BTN / mBoB marketplace" },
  { market: "international", rate: "5%", note: "USD-band marketplace" },
];

export default async function AdminCommissionsPage() {
  const { rows, error, mtdBtn } = await loadCommissionLedger(250);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">OTA Commissions</h1>
          <p className="text-sm text-muted-foreground">
            Append-only ledger for Innora-attributed marketplace bookings. Desk walk-ins do not
            accrue here.
          </p>
        </div>
        <p className="rounded-lg border bg-card px-3 py-2 text-sm">
          MTD accrued: <strong>{formatBtn(mtdBtn)}</strong>
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2">
        {DEFAULT_RATES.map((r) => (
          <div key={r.market} className="rounded-xl border bg-card p-4 text-sm">
            <p className="text-xs uppercase text-muted-foreground">{r.market}</p>
            <p className="mt-1 text-xl font-semibold">{r.rate}</p>
            <p className="text-muted-foreground">{r.note}</p>
          </div>
        ))}
      </section>

      <RecordCommissionForm />

      {error ? (
        <EmptyState title="Could not load ledger" description={error} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No commission rows yet"
          description="Confirm a marketplace hold (deposit paid) or record a ledger entry above."
          action={
            <Link href="/admin/partner" className="text-sm underline">
              Partner oversight
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Hotel</th>
                <th className="px-3 py-2">Market</th>
                <th className="px-3 py-2">Gross</th>
                <th className="px-3 py-2">Rate</th>
                <th className="px-3 py-2">Commission</th>
                <th className="px-3 py-2">Booking</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">{r.propertyName}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.market}</td>
                  <td className="px-3 py-2 tabular-nums">{formatBtn(r.grossBtn)}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {(r.commissionRate * 100).toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 font-semibold tabular-nums">
                    {formatBtn(r.commissionBtn)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {r.bookingId ? r.bookingId.slice(0, 8) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
