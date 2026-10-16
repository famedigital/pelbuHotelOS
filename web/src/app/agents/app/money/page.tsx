import { HoldCountdown } from "@/components/erp/HoldCountdown";
import {
  AgentGhostLink,
  AgentMetric,
  AgentPageHero,
  AgentPrimaryLink,
} from "@/components/erp/agent-portal/AgentPortalChrome";
import { requireAgentPropertySession } from "@/lib/agent-auth";
import { loadAgentBookings } from "@/lib/agent-occupancy";
import { loadAgentMoneyCockpit } from "@/lib/agent-portal-money";
import { formatBtn } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ from?: string; to?: string }>;
};

export default async function AgentMoneyPage({ searchParams }: Props) {
  const session = await requireAgentPropertySession();
  const sp = await searchParams;
  const admin = createSupabaseAdminClient();

  const from =
    sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : undefined;
  const to = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : undefined;

  const [cockpit, openHolds] = await Promise.all([
    loadAgentMoneyCockpit(admin, {
      agentId: session.agentId,
      links: session.links,
      from,
      to,
      sessionAgentId: session.agentId,
    }),
    loadAgentBookings(admin, session.agentId, 40, session.activePropertyId),
  ]);

  const holds = openHolds.filter((b) => b.status === "held" && b.holdExpiresAt);
  const activeHotel = cockpit.hotels.find(
    (h) => h.propertyId === session.activePropertyId,
  );
  const detail = activeHotel?.detail ?? null;

  return (
    <div className="space-y-8">
      <AgentPageHero
        eyebrow="Collections"
        title="Money & dues"
        blurb={`Paid, outstanding, and frequency · ${cockpit.from} → ${cockpit.to}`}
        actions={
          <>
            <AgentPrimaryLink
              href={`/agents/app/money/statement?from=${cockpit.from}&to=${cockpit.to}`}
            >
              Statement
            </AgentPrimaryLink>
            <AgentGhostLink href="/agents/app/stays">Stays table</AgentGhostLink>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `${session.companyName} · Innora dues ${cockpit.from}→${cockpit.to}: paid ${formatBtn(cockpit.rollup.paid_btn)}, due ${formatBtn(cockpit.rollup.outstanding_btn)} (${cockpit.rollup.room_nights} RN).`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-border bg-background/80 px-4 text-sm font-medium"
            >
              WhatsApp
            </a>
          </>
        }
      />

      <form
        className="flex flex-wrap items-end gap-2 print:hidden"
        action="/agents/app/money"
      >
        <label className="text-xs text-muted-foreground">
          From
          <input
            type="date"
            name="from"
            defaultValue={cockpit.from}
            className="mt-1 flex h-10 rounded-md border border-input bg-background px-2 text-sm"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          To
          <input
            type="date"
            name="to"
            defaultValue={cockpit.to}
            className="mt-1 flex h-10 rounded-md border border-input bg-background px-2 text-sm"
          />
        </label>
        <button
          type="submit"
          className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Apply
        </button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AgentMetric label="Stays" value={String(cockpit.rollup.stays)} />
        <AgentMetric
          label="Room-nights"
          value={String(cockpit.rollup.room_nights)}
          tone="ok"
        />
        <AgentMetric label="Paid" value={formatBtn(cockpit.rollup.paid_btn)} />
        <AgentMetric
          label="Due"
          value={formatBtn(cockpit.rollup.outstanding_btn)}
          tone={cockpit.rollup.outstanding_btn > 0.5 ? "warn" : "default"}
        />
      </div>

      {session.links.length > 1 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">By hotel</h2>
          <ul className="space-y-2">
            {cockpit.hotels.map((h) => {
              const s = h.detail?.summary;
              return (
                <li
                  key={h.propertyId}
                  className="rounded-xl border border-border px-4 py-3 text-sm"
                >
                  <p className="font-medium">{h.propertyName}</p>
                  <p className="mt-1 text-muted-foreground">
                    {s
                      ? `${s.stays} stays · ${s.room_nights} RN · paid ${formatBtn(s.paid_btn)} · due ${formatBtn(s.outstanding_btn)}`
                      : "No activity in range"}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {holds.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Open holds (flight timer)</h2>
          <ul className="space-y-2">
            {holds.map((b) => (
              <li
                key={b.id}
                className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm"
              >
                <p className="font-medium">
                  {b.checkIn} → {b.checkOut} · {b.rooms} room
                  {b.rooms === 1 ? "" : "s"}
                </p>
                {b.holdExpiresAt ? (
                  <p className="mt-1">
                    Time left: <HoldCountdown expiresAt={b.holdExpiresAt} />
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {detail ? (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">
              Frequency · {activeHotel?.propertyName}
            </h2>
            <p className="text-xs text-muted-foreground">{detail.summary.habit}</p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Month</th>
                    <th className="px-3 py-2">Stays</th>
                    <th className="px-3 py-2">Rooms</th>
                    <th className="px-3 py-2">RN</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.by_month.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-4 text-muted-foreground"
                      >
                        No stays in range.
                      </td>
                    </tr>
                  ) : (
                    detail.by_month.map((m) => (
                      <tr key={m.month} className="border-t">
                        <td className="px-3 py-2 font-medium">{m.month}</td>
                        <td className="px-3 py-2 tabular-nums">{m.stays}</td>
                        <td className="px-3 py-2 tabular-nums">{m.rooms}</td>
                        <td className="px-3 py-2 tabular-nums">
                          {m.room_nights}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Payments</h2>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Paid on</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Method</th>
                    <th className="px-3 py-2">Stay</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.payments.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-4 text-muted-foreground"
                      >
                        No payments recorded yet for this hotel.
                      </td>
                    </tr>
                  ) : (
                    detail.payments.map((p, i) => (
                      <tr key={`${p.paid_at}-${i}`} className="border-t">
                        <td className="px-3 py-2 tabular-nums">{p.paid_at}</td>
                        <td className="px-3 py-2 tabular-nums">
                          {formatBtn(p.amount_btn)}
                        </td>
                        <td className="px-3 py-2">{p.method}</td>
                        <td className="px-3 py-2">
                          {p.booking_check_in ?? "—"}
                          {p.guest ? ` · ${p.guest}` : ""}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Stays</h2>
            <ul className="space-y-2">
              {detail.stays.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {s.check_in} → {s.check_out}
                    </p>
                    <p className="text-muted-foreground">
                      {s.rooms} room{s.rooms === 1 ? "" : "s"} · {s.room_nights}{" "}
                      RN · {s.status}
                      {s.guest ? ` · ${s.guest}` : ""}
                    </p>
                  </div>
                  <span className="tabular-nums text-muted-foreground">
                    {formatBtn(s.quoted_btn)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}

