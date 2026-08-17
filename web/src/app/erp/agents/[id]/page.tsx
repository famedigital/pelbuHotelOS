import {
  DeskListShell,
  DeskTable,
  StatusPill,
} from "@/components/erp/DeskListShell";
import { AgentDossierTabNav } from "@/components/erp/AgentDossierTabNav";
import { PrintButton } from "@/components/erp/PrintButton";
import { VoidAgentCreditPaymentForm } from "@/components/erp/VoidAgentCreditPaymentForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { agentDossierMonthPresets } from "@/lib/erp/agent-links";
import { fmtDate, thimphuToday } from "@/lib/erp-lists";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { formatBtn } from "@/lib/pricing";
import {
  defaultDossierRange,
  loadAgentDossier,
  parseAgentDossierTab,
} from "@/lib/reports/agent-dossier";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const metadata = {
  title: "Agent dossier | Pelbu OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tab?: string;
    from?: string;
    to?: string;
    status?: string;
  }>;
};

export default async function AgentDossierPage({ params, searchParams }: Props) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const { id } = await params;
  const sp = await searchParams;
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const today = thimphuToday();
  const defaults = defaultDossierRange(today);
  const from =
    sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : defaults.from;
  const to = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : defaults.to;
  const tab = parseAgentDossierTab(sp.tab);
  const statusFilter = sp.status?.trim() || "";

  const dossier = await loadAgentDossier(admin, {
    propertyId,
    agentId: id,
    from,
    to,
    today,
  });
  if (!dossier) notFound();

  const { agent, money, summary } = dossier;
  const filteredBookings = statusFilter
    ? dossier.bookingsInRange.filter((b) => b.status === statusFilter)
    : dossier.bookingsInRange;

  return (
    <DeskListShell
      title="Agent"
      eyebrow="Channels · Agent"
      heading={agent.company_name}
      blurb={`${agent.market} · ${agent.contact_name ?? "—"} · ${agent.contact_phone ?? "—"} · ${from} → ${to}`}
      filters={
        <form
          className="flex flex-wrap items-end gap-2"
          action={`/erp/agents/${id}`}
          method="get"
        >
          <input type="hidden" name="tab" value={tab} />
          <div className="space-y-1">
            <Label htmlFor="dossier-from" className="text-xs">
              From
            </Label>
            <Input
              id="dossier-from"
              type="date"
              name="from"
              defaultValue={from}
              className="h-9 w-[10.5rem]"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dossier-to" className="text-xs">
              To
            </Label>
            <Input
              id="dossier-to"
              type="date"
              name="to"
              defaultValue={to}
              className="h-9 w-[10.5rem]"
            />
          </div>
          <Button type="submit" size="sm" className="h-9">
            Apply
          </Button>
          <div className="flex flex-wrap gap-1">
            {agentDossierMonthPresets(today).map((p) => (
              <Button
                key={p.id}
                asChild
                type="button"
                size="sm"
                variant={
                  from === p.from && to === p.to ? "secondary" : "outline"
                }
                className="h-9"
              >
                <Link
                  href={`/erp/agents/${id}?tab=${tab}&from=${p.from}&to=${p.to}${
                    statusFilter
                      ? `&status=${encodeURIComponent(statusFilter)}`
                      : ""
                  }`}
                >
                  {p.label}
                </Link>
              </Button>
            ))}
          </div>
          <Button asChild type="button" variant="outline" size="sm" className="h-9">
            <Link href="/erp/agents">← Agents</Link>
          </Button>
        </form>
      }
    >
      <AgentDossierTabNav agentId={id} tab={tab} from={from} to={to} />

      {tab === "overview" ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Status", agent.status.replace(/_/g, " ")],
              ["Rate tier", agent.rate_tier],
              ["Credit used", `${formatBtn(agent.credit_used)} / ${formatBtn(agent.credit_limit)}`],
              ["Outstanding", formatBtn(money.outstanding)],
            ].map(([label, val]) => (
              <div key={label} className="rounded-lg border bg-card px-4 py-4">
                <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
                  {label}
                </p>
                <p className="mt-2 text-lg capitalize tabular-nums text-foreground">
                  {val}
                </p>
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Bookings in range", String(summary.bookingCount)],
              ["Room-nights", String(summary.roomNights)],
              ["Quoted total", formatBtn(summary.quotedTotal)],
            ].map(([label, val]) => (
              <div key={label} className="rounded-lg border bg-card px-4 py-4">
                <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
                  {label}
                </p>
                <p className="mt-2 text-xl tabular-nums">{val}</p>
              </div>
            ))}
          </div>
          <section className="rounded-lg border bg-card p-4">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
              Payment habit
            </p>
            <p className="mt-2 text-sm text-foreground">{money.habit.blurb}</p>
            {agent.contact_email ? (
              <p className="mt-2 text-xs text-muted-foreground">{agent.contact_email}</p>
            ) : null}
          </section>

          <section className="rounded-lg border bg-card p-4 print:hidden">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
              Reports
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              eZee-style production + commission and open AR for this agent.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline" className="h-9">
                <Link
                  href={`/erp/reports/agent-production?from=${from}&to=${to}&agent_id=${id}`}
                >
                  Production + commission
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="h-9">
                <Link
                  href={`/erp/reports/agent-ar?from=${from}&to=${to}&agent_id=${id}`}
                >
                  AR &amp; payment habit
                </Link>
              </Button>
              <Button asChild size="sm" variant="ghost" className="h-9">
                <Link href={`/erp/reports`}>All reports</Link>
              </Button>
            </div>
          </section>
        </div>
      ) : null}

      {tab === "bookings" ? (
        <div className="space-y-4">
          <form
            className="flex flex-wrap items-end gap-2"
            action={`/erp/agents/${id}`}
            method="get"
          >
            <input type="hidden" name="tab" value="bookings" />
            <input type="hidden" name="from" value={from} />
            <input type="hidden" name="to" value={to} />
            <label className="text-xs text-muted-foreground">
              Status
              <select
                name="status"
                defaultValue={statusFilter}
                className="mt-1 flex h-9 w-40 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">All</option>
                <option value="held">Held</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="checked_in">Checked in</option>
                <option value="checked_out">Checked out</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
            <Button type="submit" size="sm" className="h-9">
              Filter
            </Button>
          </form>
          <DeskTable
            caption="Bookings"
            headers={["Guest", "Dates", "Nights", "Status", "Quoted", ""]}
          >
            {filteredBookings.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-muted-foreground">
                  No bookings in this range.
                </td>
              </tr>
            ) : (
              filteredBookings.map((b) => (
                <tr key={b.id} className="border-t">
                  <td className="px-3 py-2.5 font-medium">
                    {b.contact_name ?? "Guest"}
                  </td>
                  <td className="px-3 py-2.5 text-sm">
                    {fmtDate(b.check_in)} → {fmtDate(b.check_out)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{b.nights}</td>
                  <td className="px-3 py-2.5">
                    <StatusPill value={b.status} />
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-sm">
                    {b.quoted_total_btn == null
                      ? "—"
                      : formatBtn(b.quoted_total_btn)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-sm">
                    <Link
                      href={`/erp/bookings/${b.id}`}
                      className="text-accent underline-offset-4 hover:underline"
                    >
                      Open
                    </Link>
                    {b.folio_id ? (
                      <>
                        {" · "}
                        <Link
                          href={`/erp/folios/${b.folio_id}`}
                          className="text-accent underline-offset-4 hover:underline"
                        >
                          Folio
                        </Link>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </DeskTable>
        </div>
      ) : null}

      {tab === "guests" ? (
        <DeskTable caption="Guests" headers={["Guest", "Phone", "Stays", "Last in"]}>
          {dossier.guests.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-3 py-6 text-muted-foreground">
                No guests in this range.
              </td>
            </tr>
          ) : (
            dossier.guests.map((g) => (
              <tr key={g.key} className="border-t">
                <td className="px-3 py-2.5 font-medium">{g.contact_name}</td>
                <td className="px-3 py-2.5 text-sm text-muted-foreground">
                  {g.contact_phone ?? "—"}
                </td>
                <td className="px-3 py-2.5 tabular-nums">{g.stays}</td>
                <td className="px-3 py-2.5 text-sm">{fmtDate(g.last_check_in)}</td>
              </tr>
            ))
          )}
        </DeskTable>
      ) : null}

      {tab === "rooms" ? (
        <DeskTable
          caption="Rooms in range"
          headers={["Category", "Kind", "Qty lines", "Room-nights"]}
        >
          {dossier.rooms.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-3 py-6 text-muted-foreground">
                No room lines in this range.
              </td>
            </tr>
          ) : (
            dossier.rooms.map((r) => (
              <tr
                key={`${r.room_type_code}-${r.inventory_kind}`}
                className="border-t"
              >
                <td className="px-3 py-2.5 font-medium">
                  {r.room_type_name}{" "}
                  <span className="text-xs text-muted-foreground">
                    ({r.room_type_code})
                  </span>
                </td>
                <td className="px-3 py-2.5 text-sm capitalize text-muted-foreground">
                  {r.inventory_kind.replace(/_/g, " ")}
                </td>
                <td className="px-3 py-2.5 tabular-nums">{r.qty}</td>
                <td className="px-3 py-2.5 tabular-nums">{r.room_nights}</td>
              </tr>
            ))
          )}
        </DeskTable>
      ) : null}

      {tab === "money" ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-4 print:grid-cols-4">
            {[
              [
                "Open rooms / cap",
                `${money.openRoomsInHouse} / ${agent.open_room_cap}`,
              ],
              ["Agent owes (credit used)", formatBtn(agent.credit_used)],
              ["Credit limit (soft Nu)", formatBtn(agent.credit_limit)],
              ["Outstanding folios", formatBtn(money.outstanding)],
            ].map(([label, val]) => (
              <div key={label} className="rounded-lg border bg-card px-4 py-4">
                <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
                  {label}
                </p>
                <p className="mt-2 text-xl tabular-nums text-foreground">{val}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Folio charges in range", formatBtn(money.folioTotal)],
              ["Paid (folio payments)", formatBtn(money.paid)],
            ].map(([label, val]) => (
              <div key={label} className="rounded-lg border bg-card px-4 py-4">
                <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
                  {label}
                </p>
                <p className="mt-2 text-xl tabular-nums text-foreground">{val}</p>
              </div>
            ))}
          </div>

          <section className="rounded-lg border bg-card p-4 print:break-inside-avoid">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
              Settlement packs (guide evidence)
            </p>
            {money.packs.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No sealed packs yet. FO seals after guide sign on checkout.
              </p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {money.packs.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 first:border-0 first:pt-0"
                  >
                    <span>
                      {p.guestName ?? "Guest"} ·{" "}
                      {new Date(p.sealedAt).toLocaleString()}
                      {p.emailSentAt
                        ? ` · emailed ${p.emailTo ?? ""}`
                        : " · not emailed"}
                    </span>
                    <Link
                      href={`/erp/bookings/${p.bookingId}/settlement-pack`}
                      className="text-accent underline-offset-4 hover:underline"
                    >
                      Open pack
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border bg-card p-4 print:break-inside-avoid">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
              AR aging (open folio balances)
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              {[
                ["0–30", money.aging.current],
                ["31–60", money.aging.d30],
                ["61–90", money.aging.d60],
                ["90+", money.aging.d90],
              ].map(([label, val]) => (
                <div key={String(label)}>
                  <p className="text-xs text-muted-foreground">{label} days</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {formatBtn(Number(val))}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {money.habit.blurb} Total aged {formatBtn(money.aging.total)}.
            </p>
          </section>

          <div className="flex gap-2 print:hidden">
            <PrintButton label="Print statement" />
          </div>

          <DeskTable
            caption="F&B open items (lunch invoiced, payment later)"
            headers={["Invoice", "Opened", "Balance", "Status", ""]}
          >
            {money.openItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-muted-foreground">
                  No travel-agent lunch invoices yet. Settle POS as Charge
                  agent (invoice later).
                </td>
              </tr>
            ) : (
              money.openItems.map((item) => (
                <tr key={item.folioId} className="border-t">
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-foreground">
                      {item.invoiceNo ?? item.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                  </td>
                  <td className="px-3 py-2.5 text-sm">
                    {new Date(item.createdAt).toLocaleDateString("en-BT")}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {formatBtn(item.balance)}
                  </td>
                  <td className="px-3 py-2.5 text-sm uppercase tracking-wide">
                    {Math.abs(item.balance) > 0.009 && item.status !== "settled"
                      ? "unpaid"
                      : item.status}
                  </td>
                  <td className="px-3 py-2.5 print:hidden">
                    <Link
                      href={`/erp/folios/${item.folioId}`}
                      className="text-sm font-medium text-accent underline-offset-4 hover:underline"
                    >
                      Collect
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </DeskTable>

          <DeskTable caption="Payments" headers={["When", "Amount", "Method", "Ref", ""]}>
            {money.payments.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-muted-foreground">
                  No payments.
                </td>
              </tr>
            ) : (
              money.payments.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-3 py-2.5 text-sm">
                    {new Date(p.created_at).toLocaleDateString("en-BT")}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {formatBtn(p.amount_btn)}
                  </td>
                  <td className="px-3 py-2.5 text-sm">{p.method}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                    {p.reference ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 print:hidden">
                    {p.method === "agent_credit" ? (
                      <VoidAgentCreditPaymentForm
                        paymentId={p.id}
                        amountLabel={formatBtn(p.amount_btn)}
                      />
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </DeskTable>

          <DeskTable
            caption="Credit ledger"
            headers={["When", "Type", "Amount", "Balance", "Note"]}
          >
            {money.ledger.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-muted-foreground">
                  No ledger entries.
                </td>
              </tr>
            ) : (
              money.ledger.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="px-3 py-2.5 text-sm">
                    {new Date(e.created_at).toLocaleDateString("en-BT")}
                  </td>
                  <td className="px-3 py-2.5 text-sm capitalize">
                    {e.entry_type.replace(/_/g, " ")}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {formatBtn(e.amount_btn)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-sm">
                    {e.balance_after_btn == null
                      ? "—"
                      : formatBtn(e.balance_after_btn)}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {e.note ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </DeskTable>
        </div>
      ) : null}

      {tab === "rates" ? (
        <div className="space-y-8">
          <DeskTable
            caption={`Rates · tier ${agent.rate_tier}`}
            headers={["Season", "Room", "Amount"]}
          >
            {dossier.rates.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-muted-foreground">
                  No rates for this tier. Set them on Agents → rate matrix.
                </td>
              </tr>
            ) : (
              dossier.rates.map((r, i) => (
                <tr key={`${r.season_kind}-${r.room_type_name}-${i}`} className="border-t">
                  <td className="px-3 py-2.5 capitalize">{r.season_kind}</td>
                  <td className="px-3 py-2.5">{r.room_type_name}</td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {formatBtn(r.amount_btn)}
                  </td>
                </tr>
              ))
            )}
          </DeskTable>

          <DeskTable
            caption="Allotments"
            headers={["Room type", "Rooms/wk", "Valid"]}
          >
            {dossier.allotments.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-muted-foreground">
                  No allotments. Manage on{" "}
                  <Link href="/erp/allotments" className="text-accent underline">
                    Allotments
                  </Link>
                  .
                </td>
              </tr>
            ) : (
              dossier.allotments.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="px-3 py-2.5 font-medium">{a.room_type_name}</td>
                  <td className="px-3 py-2.5 tabular-nums">{a.rooms_per_week}</td>
                  <td className="px-3 py-2.5 text-sm">
                    {fmtDate(a.valid_from)} → {fmtDate(a.valid_to)}
                  </td>
                </tr>
              ))
            )}
          </DeskTable>
        </div>
      ) : null}
    </DeskListShell>
  );
}
