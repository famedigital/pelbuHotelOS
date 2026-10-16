import { AgentLivingBoard } from "@/components/erp/agent-portal/AgentLivingBoard";
import {
  AgentSection,
  AgentStatusPill,
} from "@/components/erp/agent-portal/AgentPortalChrome";
import { requireAgentPropertySession } from "@/lib/agent-auth";
import { loadAgentLivingDashboard } from "@/lib/agent-portal-dashboard";
import { formatBtn } from "@/lib/pricing";
import { agentRateTier } from "@/lib/rates";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

export const dynamic = "force-dynamic";

type RateRow = {
  season_kind: string;
  amount_btn: number;
  room_types?: { name: string } | { name: string }[] | null;
};

export default async function AgentHomePage() {
  const session = await requireAgentPropertySession();
  const admin = createSupabaseAdminClient();
  const propertyId = session.activePropertyId;
  const tier = agentRateTier(session.rateTier);

  let dash: Awaited<ReturnType<typeof loadAgentLivingDashboard>> | null = null;
  let rates: RateRow[] = [];

  try {
    const [living, rateRes] = await Promise.all([
      loadAgentLivingDashboard(admin, {
        agentId: session.agentId,
        propertyId,
        sessionAgentId: session.agentId,
      }),
      admin
        .from("room_rates")
        .select("season_kind, amount_btn, room_types(name)")
        .eq("property_id", propertyId)
        .eq("rate_tier", tier)
        .order("season_kind"),
    ]);
    dash = living;
    rates = (rateRes.data ?? []) as unknown as RateRow[];
  } catch (e) {
    console.error("agent home load failed", e);
  }

  if (!dash) {
    return (
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Could not load dashboard</CardTitle>
          <CardDescription>Try again or open Stays.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/agents/app/stays" className="text-sky-800 underline">
            Stays table
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <AgentLivingBoard dash={dash} companyName={session.companyName} />

      <AgentSection
        title={`Your ${tier.replace(/_/g, " ")} rates`}
        description="Published partner sheet"
        action={
          <Link
            href="/agents/app/book"
            className="text-sm font-medium text-sky-700 underline-offset-4 hover:underline"
          >
            Book on rate
          </Link>
        }
      >
        {rates.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            Rates not published yet. Ask the desk.
          </p>
        ) : (
          <Card className="overflow-hidden shadow-none">
            <CardContent className="p-0">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b bg-muted/40 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  <tr>
                    <th className="px-4 py-3">Room</th>
                    <th className="px-4 py-3">Season</th>
                    <th className="px-4 py-3 text-right">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map((r, i) => {
                    const rt = r.room_types;
                    const room = Array.isArray(rt) ? rt[0] : rt;
                    return (
                      <tr
                        key={`${r.season_kind}-${i}`}
                        className="border-b border-border/50 last:border-0"
                      >
                        <td className="px-4 py-3 font-medium">
                          {room?.name ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <AgentStatusPill
                            tone={
                              r.season_kind === "peak"
                                ? "warn"
                                : r.season_kind === "lean"
                                  ? "ok"
                                  : "muted"
                            }
                          >
                            {r.season_kind}
                          </AgentStatusPill>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">
                          {formatBtn(Number(r.amount_btn))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </AgentSection>
    </div>
  );
}
