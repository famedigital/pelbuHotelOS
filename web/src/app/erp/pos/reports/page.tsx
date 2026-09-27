import { PosReportsTabs } from "@/components/erp/pos/PosReportsTabs";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import {
  buildPosReports,
  parsePosReportRange,
  parsePosReportView,
} from "@/lib/fnb/pos-reports";
import { formatBtn } from "@/lib/pricing";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "F&B reports",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ view?: string; from?: string; to?: string }>;
};

export default async function PosReportsPage({ searchParams }: Props) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const sp = await searchParams;
  const view = parsePosReportView(sp.view);
  const { from, to } = parsePosReportRange(sp.from, sp.to);
  const pack = await buildPosReports(from, to);

  return (
    <div className="erp mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          POS
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">F&B reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Settled tickets for this property. Voids are counted separately.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <input type="hidden" name="view" value={view} />
            <div className="space-y-1.5">
              <Label htmlFor="from">From</Label>
              <Input id="from" name="from" type="date" defaultValue={from} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to">To</Label>
              <Input id="to" name="to" type="date" defaultValue={to} />
            </div>
            <Button type="submit">Show</Button>
          </form>
        </CardContent>
      </Card>

      <PosReportsTabs view={view} from={from} to={to} />

      {view === "day" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Bills" value={String(pack.bills)} />
          <Stat label="Sales" value={formatBtn(pack.salesBtn)} />
          <Stat label="Average ticket" value={formatBtn(pack.avgBtn)} />
          <Stat
            label="Voids"
            value={`${pack.voidCount} · ${formatBtn(pack.voidBtn)}`}
          />
        </div>
      ) : null}

      {view === "cashier" ? (
        <ReportCard
          title="Cashier"
          description="Who closed the ticket, and how it was paid."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Server</TableHead>
                <TableHead className="text-right">Bills</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="text-right">Cash</TableHead>
                <TableHead className="text-right">Room</TableHead>
                <TableHead className="text-right">Other</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pack.byCashier.length === 0 ? (
                <EmptyRow cols={6} />
              ) : (
                pack.byCashier.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.bills}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBtn(row.salesBtn)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBtn(row.cashBtn)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBtn(row.roomBtn)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBtn(row.otherBtn)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ReportCard>
      ) : null}

      {view === "tenders" ? (
        <ReportCard
          title="Tenders"
          description="Cash, bank, card, room charge, comp, and staff meal."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tender</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pack.byTender.length === 0 ? (
                <EmptyRow cols={2} />
              ) : (
                pack.byTender.map((row) => (
                  <TableRow key={row.method}>
                    <TableCell>{row.label}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBtn(row.amountBtn)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ReportCard>
      ) : null}

      {view === "hour" ? (
        <ReportCard
          title="Hour"
          description="Settled sales by hour in Thimphu."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hour</TableHead>
                <TableHead className="text-right">Bills</TableHead>
                <TableHead className="text-right">Sales</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pack.byHour.length === 0 ? (
                <EmptyRow cols={3} />
              ) : (
                pack.byHour.map((row) => (
                  <TableRow key={row.hour}>
                    <TableCell className="tabular-nums">{row.hour}:00</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.bills}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBtn(row.salesBtn)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ReportCard>
      ) : null}

      {view === "items" ? (
        <ReportCard
          title="Items"
          description="Quantity and sales by dish and outlet."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dish</TableHead>
                <TableHead>Outlet</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Sales</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pack.byItem.length === 0 ? (
                <EmptyRow cols={4} />
              ) : (
                pack.byItem.map((row) => (
                  <TableRow key={`${row.outlet}-${row.name}`}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell className="capitalize">{row.outlet}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.qty}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBtn(row.salesBtn)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ReportCard>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Also on the desk</CardTitle>
          <CardDescription>
            Shift close, night audit, and costing stay on their own pages.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/erp/pos">Register · shift close</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/erp/night-audit">Night audit Z</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/erp/pos/recipe-cost">Recipe cost</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/erp/pos/menu-engineering">Menu engineering</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-lg tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function ReportCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function EmptyRow({ cols }: { cols: number }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="text-muted-foreground">
        No settled tickets in this range.
      </TableCell>
    </TableRow>
  );
}
