import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { KitchenMealService } from "@/lib/kitchen/meal-service";
import Link from "next/link";

const LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

export function MealServiceBoard({
  services,
  businessDate,
  title = "Published meal service",
  emptyHint = "Kitchen has not published BF / lunch / dinner for this date yet.",
}: {
  services: KitchenMealService[];
  businessDate: string;
  title?: string;
  emptyHint?: string;
}) {
  return (
    <Card className={services.length ? "border-citrus/40 bg-citrus-tint/20" : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>
          Kitchen feed for FO / F&amp;B · {businessDate}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {services.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {emptyHint}{" "}
            <Link
              href="/erp/kitchen"
              className="text-accent underline-offset-4 hover:underline"
            >
              Kitchen board →
            </Link>
          </p>
        ) : (
          <ul className="space-y-4">
            {services.map((svc) => (
              <li key={svc.id} className="rounded-lg border bg-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {LABELS[svc.mealPeriod] ?? svc.mealPeriod}
                    </Badge>
                    <span className="text-lg font-semibold tabular-nums">
                      {svc.heads}
                    </span>
                    <span className="text-xs text-muted-foreground">heads</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(svc.publishedAt).toISOString().slice(11, 16)} UTC
                    {svc.publishedBy ? ` · ${svc.publishedBy}` : ""}
                  </span>
                </div>
                {svc.menuNote ? (
                  <p className="mt-2 text-sm text-foreground">{svc.menuNote}</p>
                ) : null}
                {svc.menuHighlights ? (
                  <p className="mt-1 text-xs font-medium text-accent">
                    Highlight: {svc.menuHighlights}
                  </p>
                ) : null}
                {svc.guestFeed.length > 0 ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                      Guest list ({svc.guestFeed.length})
                    </summary>
                    <ul className="mt-1 max-h-40 space-y-0.5 overflow-auto text-xs">
                      {svc.guestFeed.map((g) => (
                        <li
                          key={`${svc.id}-${g.bookingId}`}
                          className="flex justify-between gap-2 border-t py-1"
                        >
                          <span>
                            <Link
                              href={`/erp/bookings/${g.bookingId}`}
                              className="font-medium hover:text-accent"
                            >
                              {g.guestName}
                            </Link>
                            <span className="text-muted-foreground">
                              {" "}
                              · {g.rooms || "—"} · {g.mealPlanCode}
                            </span>
                          </span>
                          <span className="tabular-nums text-muted-foreground">
                            {g.adults} pax
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
