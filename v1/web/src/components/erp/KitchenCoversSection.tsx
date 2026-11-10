import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { MealCovers } from "@/lib/kitchen/covers";
import Link from "next/link";

const MEAL_LABELS = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
} as const;

function mealBadges(guest: MealCovers["guests"][number]) {
  const tags: string[] = [];
  if (guest.inclusions.breakfast) tags.push("BF");
  if (guest.inclusions.lunch) tags.push("Lunch");
  if (guest.inclusions.dinner) tags.push("Dinner");
  return tags;
}

export function KitchenCoversSection({
  covers,
  businessDate,
}: {
  covers: MealCovers;
  businessDate: string;
}) {
  const totals = [
    { key: "breakfast" as const, value: covers.breakfast },
    { key: "lunch" as const, value: covers.lunch },
    { key: "dinner" as const, value: covers.dinner },
  ];

  return (
    <Card className="border-accent/30 bg-accent/5">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Covers today</CardTitle>
            <CardDescription>
              In-house guests on meal plans (BB / MAP / AP) plus kitchen events ·{" "}
              {businessDate}
            </CardDescription>
          </div>
          <Link
            href="/erp/in-house"
            className="text-xs font-medium text-accent underline-offset-4 hover:underline"
          >
            In-house list →
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {totals.map(({ key, value }) => (
            <div
              key={key}
              className="rounded-xl border bg-card px-3 py-4 text-center sm:px-4"
            >
              <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                {MEAL_LABELS[key]}
              </p>
              <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl">
                {value}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">heads</p>
            </div>
          ))}
        </div>

        {covers.eventCovers > 0 ? (
          <p className="text-sm text-muted-foreground">
            Includes{" "}
            <span className="font-medium text-foreground">{covers.eventCovers}</span>{" "}
            extra covers from events / groups today.
          </p>
        ) : null}

        <details className="group rounded-xl border bg-card">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              Guest &amp; room breakdown
              <Badge variant="secondary" className="font-normal">
                {covers.guests.length} booking
                {covers.guests.length === 1 ? "" : "s"}
              </Badge>
              <span className="text-xs font-normal text-muted-foreground group-open:hidden">
                (tap to expand)
              </span>
            </span>
          </summary>
          <div className="border-t px-2 pb-2">
            {covers.guests.length === 0 ? (
              <p className="px-2 py-4 text-sm text-muted-foreground">
                No in-house guests on meal plans today. Room-only (EP) stays are not
                counted here.
              </p>
            ) : (
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 border-b bg-muted/50 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Guest</th>
                      <th className="px-3 py-2">Room</th>
                      <th className="px-3 py-2">Plan</th>
                      <th className="px-3 py-2 text-right">Adults</th>
                      <th className="px-3 py-2">Meals</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {covers.guests.map((guest) => (
                      <tr key={guest.bookingId} className="hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <Link
                            href={`/erp/bookings/${guest.bookingId}`}
                            className="font-medium hover:text-accent"
                          >
                            {guest.guestName}
                          </Link>
                          {guest.status === "confirmed" ? (
                            <span className="ml-2 text-[10px] text-muted-foreground">
                              arriving
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {guest.rooms || "—"}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {guest.mealPlanCode}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {guest.adults}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {mealBadges(guest).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-[10px]">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
