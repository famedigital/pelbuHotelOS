import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MenuItem } from "@/lib/menu";
import Link from "next/link";

export function PosStockPanel({ items }: { items: MenuItem[] }) {
  const tracked = items
    .filter((item) => item.stock_mode && item.stock_mode !== "untracked")
    .sort(
      (a, b) =>
        Number(Boolean(b.sold_out)) - Number(Boolean(a.sold_out)) ||
        (a.stock_on_hand ?? Infinity) - (b.stock_on_hand ?? Infinity) ||
        a.name.localeCompare(b.name),
    );

  return (
    <section className="rounded-xl border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
            Live availability
          </p>
          <h2 className="mt-1 text-lg font-semibold">Menu stock</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Available servings after recipe and finished-goods consumption.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/erp/menu">Receive or configure stock</Link>
        </Button>
      </div>
      {tracked.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No tracked menu items. Configure purchased items or recipes in Menu.
        </div>
      ) : (
        <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {tracked.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="text-[11px] capitalize text-muted-foreground">
                  {item.stock_mode?.replace("_", " ")} · {item.outlet}
                </p>
              </div>
              {item.sold_out ? (
                <Badge variant="destructive">Sold out</Badge>
              ) : (
                <Badge variant="outline" className="tabular-nums">
                  {item.stock_on_hand ?? "—"} left
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
