import { CATALOG_PACKAGES, ONE_TIME_FEES, formatBtn } from "@/lib/pricing-catalog";

export const metadata = { title: "Packages", robots: { index: false, follow: false } };

export default function AdminPackagesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Packages</h1>
        <p className="text-sm text-muted-foreground">
          Catalog MSRP and royalty (seeded in DB; edit via SQL/admin later). One-time
          fees: onboarding {formatBtn(ONE_TIME_FEES.onboardingBtn)}, training{" "}
          {formatBtn(ONE_TIME_FEES.trainingBtn)}.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Rooms</th>
              <th className="px-3 py-2">MSRP / mo</th>
              <th className="px-3 py-2">Royalty / mo</th>
            </tr>
          </thead>
          <tbody>
            {CATALOG_PACKAGES.map((p) => (
              <tr key={p.code} className="border-b">
                <td className="px-3 py-2 font-medium">{p.name}</td>
                <td className="px-3 py-2">
                  {p.roomMin}–{p.roomMax ?? "∞"}
                </td>
                <td className="px-3 py-2">{formatBtn(p.msrpBtnMo)}</td>
                <td className="px-3 py-2">{formatBtn(p.royaltyBtnMo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
