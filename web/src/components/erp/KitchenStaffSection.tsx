import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatShiftOutlet } from "@/lib/shift-outlets";
import type { KitchenStaffBoard, KitchenStaffPresence } from "@/lib/kitchen/staff-shift";
import Link from "next/link";

const toneStyles = {
  green: {
    ring: "border-citrus/40",
    bg: "bg-citrus-tint/30",
    dot: "bg-citrus",
  },
  amber: {
    ring: "border-amber-400/50",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    dot: "bg-amber-500",
  },
  red: {
    ring: "border-destructive/40",
    bg: "bg-destructive/5",
    dot: "bg-destructive",
  },
} as const;

const presenceMeta: Record<
  KitchenStaffPresence,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  present: { label: "Present", variant: "default" },
  on_break: { label: "On break", variant: "secondary" },
  absent: { label: "Absent", variant: "destructive" },
  off_duty: { label: "Clocked out", variant: "outline" },
  on_leave: { label: "On leave", variant: "outline" },
};

export function KitchenStaffSection({
  board,
  businessDate,
}: {
  board: KitchenStaffBoard;
  businessDate: string;
}) {
  const style = toneStyles[board.tone];

  return (
    <Card className={`${style.ring} ${style.bg}`}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">Staff today</CardTitle>
              <span
                className={`size-2.5 rounded-full ${style.dot}`}
                aria-hidden
              />
            </div>
            <CardDescription>
              Kitchen &amp; F&B roster · clock-in presence · {businessDate}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/erp/hr/rota"
              className="inline-flex h-8 items-center rounded-md border bg-card px-3 text-xs font-medium hover:bg-muted"
            >
              Schedule →
            </Link>
            <Link
              href="/erp/hr/attendance"
              className="inline-flex h-8 items-center rounded-md border bg-card px-3 text-xs font-medium hover:bg-muted"
            >
              Live duty →
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Rostered", board.rostered],
            ["Present", board.present],
            ["Absent", board.absent],
            ["On leave", board.onLeave],
          ].map(([label, value]) => (
            <div
              key={label as string}
              className="rounded-xl border bg-card px-3 py-3 text-center"
            >
              <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                {label}
              </p>
              <p
                className={`mt-1 text-3xl font-semibold tabular-nums sm:text-4xl ${
                  label === "Absent" && board.absent > 0
                    ? "text-destructive"
                    : label === "Present" && board.present > 0
                      ? "text-citrus"
                      : ""
                }`}
              >
                {value}
              </p>
            </div>
          ))}
        </div>

        {board.outletGaps.length > 0 ? (
          <div className="rounded-lg border border-amber-400/40 bg-amber-50/80 px-3 py-2 text-sm dark:bg-amber-950/20">
            <span className="font-medium">Shift gaps:</span>{" "}
            {board.outletGaps.join(", ")} — no one rostered.{" "}
            <Link href="/erp/hr/rota" className="text-accent underline-offset-4 hover:underline">
              Fill on Schedule
            </Link>
          </div>
        ) : board.rostered === 0 ? (
          <p className="text-sm text-muted-foreground">
            No published F&amp;B shifts today.{" "}
            <Link href="/erp/hr/rota" className="text-accent underline-offset-4 hover:underline">
              Publish rota →
            </Link>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Core outlets (restaurant, cafe, bar) have roster coverage.
            {board.offDuty > 0 ? ` ${board.offDuty} already clocked out.` : null}
          </p>
        )}

        {board.rows.length > 0 ? (
          <div className="max-h-72 overflow-auto rounded-xl border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 border-b bg-muted/50 text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Staff</th>
                  <th className="px-3 py-2">Outlet</th>
                  <th className="px-3 py-2">Shift</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Last punch</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {board.rows.map((row) => {
                  const meta = presenceMeta[row.presence];
                  return (
                    <tr key={row.shiftId} className="hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <p className="font-medium">{row.fullName}</p>
                        <p className="text-xs text-muted-foreground">{row.roleLabel}</p>
                      </td>
                      <td className="px-3 py-2 capitalize text-muted-foreground">
                        {formatShiftOutlet(row.outlet)}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">
                        {row.startsAt}–{row.endsAt}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {row.lastPunchAt
                          ? new Date(row.lastPunchAt).toLocaleTimeString("en-GB", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
