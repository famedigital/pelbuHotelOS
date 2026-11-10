import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { TenantLicenseControls } from "@/components/platform/TenantLicenseControls";
import { formatBtn } from "@/lib/pricing-catalog";
import { loadTenantLicenses } from "@/lib/platform/admin-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Hotels / Licences", robots: { index: false, follow: false } };

export default async function AdminHotelsPage() {
  const { rows, error } = await loadTenantLicenses();
  const mrr = rows
    .filter((r) => r.licenseStatus === "active" || r.licenseStatus === "grace")
    .reduce((s, r) => s + r.mrrBtn, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Hotels / Licences</h1>
          <p className="text-sm text-muted-foreground">
            Tenant portfolio with SaaS licence controls (merged from SuperAdmin billing desk).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-lg border px-3 py-2 text-sm">
            MRR {formatBtn(mrr)}
          </span>
          <Link
            href="/admin/hotels/new"
            className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
          >
            Onboard hotel
          </Link>
        </div>
      </div>

      {error ? (
        <EmptyState title="Could not load tenants" description={error} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No hotels yet"
          description="Onboard the first property to start national SaaS + OTA."
          action={
            <Link href="/admin/hotels/new" className="text-sm underline">
              Onboard hotel
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Package</th>
                <th className="px-3 py-2">Licence</th>
                <th className="px-3 py-2">MRR</th>
                <th className="px-3 py-2">AMC</th>
                <th className="px-3 py-2">Live</th>
                <th className="px-3 py-2">Controls</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.propertyId} className="border-b align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.name}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{r.slug}</div>
                    {r.isDemo ? (
                      <span className="text-[10px] uppercase text-amber-700">demo</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{r.packageCode ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs">
                      {r.tier}/{r.licenseStatus}
                    </span>
                    {r.paidThrough ? (
                      <div className="text-[10px] text-muted-foreground">
                        paid thru {r.paidThrough}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{formatBtn(r.mrrBtn)}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {r.amcAmountBtn != null ? formatBtn(r.amcAmountBtn) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {r.goLiveAt ? "Yes" : "Checklist"}
                  </td>
                  <td className="px-3 py-2">
                    <TenantLicenseControls
                      propertyId={r.propertyId}
                      tier={r.tier}
                      status={r.licenseStatus}
                      paidThrough={r.paidThrough}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/hotels/${r.propertyId}`} className="underline">
                      Open
                    </Link>
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
