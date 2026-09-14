import { FnbSectionHeader } from "@/components/erp/fnb/FnbSectionHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildLaborCoversReport } from "@/lib/fnb/labor-covers";
import { formatBtn } from "@/lib/pricing";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function LaborCoversPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const report = await buildLaborCoversReport(params.from, params.to);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <FnbSectionHeader
        title="Labor vs covers"
        description={`${report.from} → ${report.to} · estimated from active F&B staff wages pro-rated + covers on settled tickets.`}
      />
      <Link href="/erp/kitchen" className="text-sm text-muted-foreground">
        ← Kitchen board
      </Link>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Covers</p>
            <p className="text-2xl font-semibold tabular-nums">{report.covers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Labor cost (est.)</p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatBtn(report.laborCostBtn)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Per cover</p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatBtn(report.laborPerCoverBtn)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Service charge collected</p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatBtn(report.scShareBtn)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Attendance punches</p>
            <p className="text-2xl font-semibold tabular-nums">
              {report.attendanceEvents}
            </p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notes</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Tip and service-charge share to payroll uses HR{" "}
          <code className="text-xs">service_charge_eligible</code> fields on
          staff dossiers when running payroll.
        </CardContent>
      </Card>
    </div>
  );
}
