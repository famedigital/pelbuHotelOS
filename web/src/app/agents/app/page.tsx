import { agentLogout } from "@/app/actions/agent-auth";
import { requireAgentSession } from "@/lib/agent-auth";
import { loadAgentBookings } from "@/lib/agent-occupancy";
import { formatBtn } from "@/lib/pricing";
import { agentRateTier } from "@/lib/rates";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import Link from "next/link";

export const dynamic = "force-dynamic";

type RateRow = {
  season_kind: string;
  amount_btn: number;
  room_types?: { name: string } | { name: string }[] | null;
};

export default async function AgentAccountPage() {
  const session = await requireAgentSession();
  const admin = createSupabaseAdminClient();

  const { data: property } = await admin
    .from("properties")
    .select("id")
    .eq("slug", PELBU_PROPERTY_SLUG)
    .single();

  const tier = agentRateTier(session.rateTier);
  const available = Math.max(0, session.creditLimit - session.creditUsed);

  const [{ data: rateRows }, bookings] = await Promise.all([
    property
      ? admin
          .from("room_rates")
          .select("season_kind, amount_btn, room_types(name)")
          .eq("property_id", property.id as string)
          .eq("rate_tier", tier)
          .order("season_kind")
      : Promise.resolve({ data: [] as RateRow[] }),
    loadAgentBookings(admin, session.agentId, 6),
  ]);

  const rates = (rateRows ?? []) as unknown as RateRow[];

  return (
    <div className="space-y-8">
      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Credit limit" value={formatBtn(session.creditLimit)} />
        <SummaryCard label="Available" value={formatBtn(available)} highlight />
        <SummaryCard label="Used" value={formatBtn(session.creditUsed)} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            Your {tier.replace(/_/g, " ")} rates
          </h2>
        </div>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Room</th>
                <th className="px-4 py-2.5 font-medium">Season</th>
                <th className="px-4 py-2.5 text-right font-medium">Rate</th>
              </tr>
            </thead>
            <tbody>
              {rates.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-5 text-muted-foreground">
                    Rates not published yet. Ask the desk.
                  </td>
                </tr>
              ) : (
                rates.map((r, i) => {
                  const rt = r.room_types;
                  const room = Array.isArray(rt) ? rt[0] : rt;
                  return (
                    <tr
                      key={`${r.season_kind}-${i}`}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="px-4 py-2.5">{room?.name ?? "—"}</td>
                      <td className="px-4 py-2.5 capitalize text-muted-foreground">
                        {r.season_kind}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {formatBtn(Number(r.amount_btn))}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent bookings</h2>
          <Link
            href="/agents/app/calendar"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            View all
          </Link>
        </div>
        {bookings.length === 0 ? (
          <p className="rounded-xl border border-border px-4 py-5 text-sm text-muted-foreground">
            No bookings yet. Tap Book to hold rooms on your rate.
          </p>
        ) : (
          <ul className="space-y-2">
            {bookings.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {b.checkIn} → {b.checkOut}
                  </p>
                  <p className="text-muted-foreground">
                    {b.rooms} room{b.rooms === 1 ? "" : "s"} · {b.status}
                  </p>
                </div>
                <span className="tabular-nums text-muted-foreground">
                  {b.quotedTotalBtn == null ? "—" : formatBtn(b.quotedTotalBtn)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form action={agentLogout} className="md:hidden">
        <button
          type="submit"
          className="min-h-11 w-full rounded-xl border border-border text-sm font-medium"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-4 ${
        highlight ? "border-primary/40 bg-primary/5" : "border-border"
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
