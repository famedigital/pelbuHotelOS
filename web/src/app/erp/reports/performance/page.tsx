import { PerformanceTargetForm } from "@/components/erp/PerformanceTargetForm";
import { PrintButton } from "@/components/erp/PrintButton";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { thimphuToday } from "@/lib/erp-lists";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { formatBtn } from "@/lib/pricing";
import {
  computeOwnerPerformance,
  formatMetricValue,
} from "@/lib/reports/performance";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Owner performance | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ from?: string; to?: string }>;
};

function monthStart(today: string): string {
  return `${today.slice(0, 7)}-01`;
}

function BarChart({
  rows,
  valueKey,
  labelKey,
  format,
}: {
  rows: Array<Record<string, string | number>>;
  valueKey: string;
  labelKey: string;
  format?: (n: number) => string;
}) {
  const max = Math.max(...rows.map((r) => Number(r[valueKey])), 1);
  const fmt = format ?? ((n: number) => String(n));
  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const val = Number(row[valueKey]);
        const pct = Math.round((val / max) * 100);
        return (
          <li key={String(row[labelKey])}>
            <div className="mb-1 flex justify-between text-sm">
              <span>{String(row[labelKey])}</span>
              <span className="tabular-nums text-muted-foreground">{fmt(val)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default async function OwnerPerformancePage({ searchParams }: Props) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const sp = await searchParams;
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const today = thimphuToday();
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const from =
    sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : yearStart;
  const to = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : today;

  const pack = await computeOwnerPerformance(admin, propertyId, from, to);

  return (
    <div className="erp mx-auto w-full max-w-[1200px] space-y-8 p-4 md:p-6 print:max-w-none">
      <header className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Owner insights
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Performance &amp; P&amp;L</h1>
          <p className="text-sm text-muted-foreground">
            Targets vs achieved · income streams · OpEx · top agents &amp; guest countries
          </p>
        </div>
        <PrintButton label="Print report" />
      </header>

      <form
        className="flex flex-wrap items-end gap-2 print:hidden"
        action="/erp/reports/performance"
        method="get"
      >
        <div className="space-y-1">
          <Label htmlFor="from" className="text-xs">
            From
          </Label>
          <Input id="from" name="from" type="date" defaultValue={from} className="h-9 w-40" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to" className="text-xs">
            To
          </Label>
          <Input id="to" name="to" type="date" defaultValue={to} className="h-9 w-40" />
        </div>
        <Button type="submit" variant="outline" className="h-9">
          Apply
        </Button>
        <Link
          href="/erp/reports"
          className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted"
        >
          All reports
        </Link>
      </form>

      <section className="space-y-3">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          {pack.yearKey} targets vs achieved
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pack.metrics.map((m) => (
            <Card key={m.metric} className="gap-2 py-4">
              <CardContent>
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {formatMetricValue(m.unit, m.achieved)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Target {formatMetricValue(m.unit, m.target)} · {m.pctOfTarget}% of target
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${
                      m.pctOfTarget >= 100 ? "bg-citrus" : m.pctOfTarget >= 70 ? "bg-amber-500" : "bg-destructive"
                    }`}
                    style={{ width: `${Math.min(100, m.pctOfTarget)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Income by stream</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              rows={pack.incomeStreams.map((r) => ({
                stream: r.stream,
                amount: r.amountBtn,
              }))}
              labelKey="stream"
              valueKey="amount"
              format={(n) => formatBtn(n)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">OpEx buckets (YTD expenses)</CardTitle>
          </CardHeader>
          <CardContent>
            {pack.opexBuckets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No posted expenses yet.</p>
            ) : (
              <BarChart
                rows={pack.opexBuckets.map((r) => ({
                  bucket: r.bucket,
                  amount: r.amountBtn,
                }))}
                labelKey="bucket"
                valueKey="amount"
                format={(n) => formatBtn(n)}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top agents</CardTitle>
          </CardHeader>
          <CardContent>
            {pack.topAgents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No agent production this year.</p>
            ) : (
              <>
                <BarChart
                  rows={pack.topAgents.map((a) => ({
                    name: a.name,
                    nights: a.roomNights,
                  }))}
                  labelKey="name"
                  valueKey="nights"
                  format={(n) => `${n} RN`}
                />
                <table className="mt-4 w-full text-left text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="pb-2">Agent</th>
                      <th className="pb-2 text-right">Bookings</th>
                      <th className="pb-2 text-right">Room-nights</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pack.topAgents.map((a) => (
                      <tr key={a.id}>
                        <td className="py-2">
                          <Link
                            href={`/erp/agents/${a.id}`}
                            className="text-accent underline-offset-4 hover:underline"
                          >
                            {a.name}
                          </Link>
                        </td>
                        <td className="py-2 text-right tabular-nums">{a.bookings}</td>
                        <td className="py-2 text-right tabular-nums">{a.roomNights}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top guest countries</CardTitle>
          </CardHeader>
          <CardContent>
            {pack.topCountries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No nationality data yet.</p>
            ) : (
              <>
                <BarChart
                  rows={pack.topCountries.map((c) => ({
                    country: c.country,
                    guests: c.guests,
                  }))}
                  labelKey="country"
                  valueKey="guests"
                />
                <table className="mt-4 w-full text-left text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="pb-2">Country</th>
                      <th className="pb-2 text-right">Guests</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pack.topCountries.map((c) => (
                      <tr key={c.country}>
                        <td className="py-2">{c.country}</td>
                        <td className="py-2 text-right tabular-nums">{c.guests}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="print:hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Edit annual target</CardTitle>
        </CardHeader>
        <CardContent>
          <PerformanceTargetForm yearKey={pack.yearKey} />
        </CardContent>
      </Card>
    </div>
  );
}
