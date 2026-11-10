/**
 * Agency central dashboard — connected hotels, rates, offers, FO pulse, money.
 */
import { Building2, CalendarRange, Percent, Wallet } from "lucide-react";
import { Badge, Button, EmptyState, GlassPanel, KpiCard } from "@hos-v2/ui";
import { formatNu } from "../../lib/front-office-store";
import type {
  AgencyOfferRow,
  ConnectedHotelRow,
  FoPulse,
} from "../../lib/b2b-portfolio";
import type { MouStatus } from "../../lib/mou-store";

function mouTone(
  status: MouStatus,
): "success" | "vip" | "danger" | "teal" | "default" {
  if (status === "active") return "success";
  if (status === "pending_counterparty") return "vip";
  if (status === "suspended" || status === "rejected") return "danger";
  if (status === "expired") return "teal";
  return "default";
}

type Props = {
  hotels: ConnectedHotelRow[];
  offers: AgencyOfferRow[];
  pulse: FoPulse;
  onOpenHotel: (propertyId: string) => void;
  onOpenTab: (tab: "rates" | "book" | "money" | "calendar" | "bookings") => void;
};

export function PartnerAgencyDashboard({
  hotels,
  offers,
  pulse,
  onOpenHotel,
  onOpenTab,
}: Props) {
  const activeHotels = hotels.filter((h) => h.mouStatus === "active");
  const arTotal = hotels.reduce((n, h) => n + h.arOutstanding, 0);
  const paidTotal = hotels.reduce((n, h) => n + h.paidTotal, 0);
  const inHouse = hotels.reduce((n, h) => n + h.staysInHouse, 0);

  return (
    <div className="flex flex-col gap-4" data-testid="partner-agency-dashboard">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Connected hotels" value={hotels.length} delta={`${activeHotels.length} active MoU`} />
        <KpiCard label="In-house (own)" value={inHouse} delta={`FO · ${pulse.businessDate}`} />
        <KpiCard label="AR outstanding" value={formatNu(arTotal)} delta="All hotels" />
        <KpiCard label="Paid collected" value={formatNu(paidTotal)} delta="Fiscal paid" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassPanel className="p-3.5 lg:col-span-2">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <strong className="flex items-center gap-1.5 text-sm">
              <Building2 className="size-4 text-[var(--hos-primary)]" />
              Hotels you are connected with
            </strong>
            <span className="text-[10px] text-[var(--hos-ink-3)]">
              MoU · rates · FO · money per property
            </span>
          </div>
          {hotels.length === 0 ? (
            <EmptyState
              title="No hotel MoUs"
              description="Propose a MoU from Bookings or wait for the hotel to invite you."
            />
          ) : (
            <>
              {/* Mobile cards — agencies book on phone */}
              <ul className="m-0 flex list-none flex-col gap-2 p-0 md:hidden">
                {hotels.map((h) => (
                  <li
                    key={`m-${h.mouId}`}
                    className="hos-luxury-card flex flex-col gap-2 px-3 py-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-[var(--hos-ink)]">
                          {h.propertyName}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <Badge tone={mouTone(h.mouStatus)}>{h.mouStatus}</Badge>
                          <span className="font-mono text-[10px] text-[var(--hos-ink-3)]">
                            {h.rateCardCode}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="!min-h-11 shrink-0 !rounded-full"
                        disabled={h.mouStatus !== "active"}
                        onClick={() => onOpenHotel(h.propertyId)}
                      >
                        Open
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <div>
                        <div className="text-[9px] uppercase text-[var(--hos-ink-3)]">
                          Dbl net
                        </div>
                        <div className="font-mono font-semibold">
                          {h.doubleNet != null ? formatNu(h.doubleNet) : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase text-[var(--hos-ink-3)]">
                          AR
                        </div>
                        <div className="font-mono font-semibold">
                          {formatNu(h.arOutstanding)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase text-[var(--hos-ink-3)]">
                          FO
                        </div>
                        <div className="font-semibold text-[var(--hos-ink-2)]">
                          {h.staysInHouse} IH · {h.staysHeld} held
                        </div>
                      </div>
                    </div>
                    <div className="text-[10px] text-[var(--hos-ink-3)]">
                      {h.offerCount} offers · Paid {formatNu(h.paidTotal)}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="hos-scrollbar-slim hidden overflow-x-auto md:block">
                <table className="hos-data w-full min-w-[720px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--hos-line)] text-[10px] uppercase text-[var(--hos-ink-3)]">
                      <th className="px-2 py-2">Hotel</th>
                      <th className="px-2 py-2">MoU</th>
                      <th className="px-2 py-2">Rate card</th>
                      <th className="px-2 py-2 text-right">Dbl net</th>
                      <th className="px-2 py-2 text-right">Offers</th>
                      <th className="px-2 py-2 text-right">FO</th>
                      <th className="px-2 py-2 text-right">AR</th>
                      <th className="px-2 py-2 text-right">Paid</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--hos-line)]">
                    {hotels.map((h) => (
                      <tr key={h.mouId}>
                        <td className="px-2 py-2 font-semibold text-[var(--hos-ink)]">
                          {h.propertyName}
                        </td>
                        <td className="px-2 py-2">
                          <Badge tone={mouTone(h.mouStatus)}>{h.mouStatus}</Badge>
                        </td>
                        <td className="px-2 py-2 font-mono">{h.rateCardCode}</td>
                        <td className="px-2 py-2 text-right font-mono tabular-nums">
                          {h.doubleNet != null ? formatNu(h.doubleNet) : "—"}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {h.offerCount}
                        </td>
                        <td className="px-2 py-2 text-right text-[10px] text-[var(--hos-ink-3)]">
                          {h.staysInHouse} IH · {h.staysHeld} held
                        </td>
                        <td className="px-2 py-2 text-right font-mono tabular-nums">
                          {formatNu(h.arOutstanding)}
                        </td>
                        <td className="px-2 py-2 text-right font-mono tabular-nums">
                          {formatNu(h.paidTotal)}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="!rounded-full"
                            disabled={h.mouStatus !== "active"}
                            onClick={() => onOpenHotel(h.propertyId)}
                          >
                            Open
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </GlassPanel>

        <GlassPanel className="flex flex-col gap-3 p-3.5">
          <strong className="flex items-center gap-1.5 text-sm">
            <CalendarRange className="size-4 text-[var(--hos-primary)]" />
            FO pulse · today
          </strong>
          <p className="m-0 text-[11px] text-[var(--hos-ink-3)]">
            Business date {pulse.businessDate} — your guests only.
          </p>
          <dl className="m-0 grid grid-cols-2 gap-2 text-xs">
            <div className="hos-luxury-card px-2.5 py-2">
              <dt className="text-[10px] uppercase text-[var(--hos-ink-3)]">Arriving</dt>
              <dd className="m-0 font-mono text-lg font-bold">{pulse.arriving}</dd>
            </div>
            <div className="hos-luxury-card px-2.5 py-2">
              <dt className="text-[10px] uppercase text-[var(--hos-ink-3)]">In-house</dt>
              <dd className="m-0 font-mono text-lg font-bold">{pulse.inHouse}</dd>
            </div>
            <div className="hos-luxury-card px-2.5 py-2">
              <dt className="text-[10px] uppercase text-[var(--hos-ink-3)]">Departing</dt>
              <dd className="m-0 font-mono text-lg font-bold">{pulse.departing}</dd>
            </div>
            <div className="hos-luxury-card px-2.5 py-2">
              <dt className="text-[10px] uppercase text-[var(--hos-ink-3)]">Held</dt>
              <dd className="m-0 font-mono text-lg font-bold">{pulse.held}</dd>
            </div>
          </dl>
          <div className="hos-luxury-card px-2.5 py-2">
            <div className="text-[10px] uppercase text-[var(--hos-ink-3)]">Own folio balance</div>
            <div className="font-mono text-base font-bold tabular-nums">
              {formatNu(pulse.ownBalance)}
            </div>
          </div>
          <div className="mt-auto flex flex-wrap gap-2">
            <Button size="sm" className="hos-btn-ink !rounded-full" onClick={() => onOpenTab("calendar")}>
              Calendar
            </Button>
            <Button size="sm" variant="secondary" className="!rounded-full" onClick={() => onOpenTab("bookings")}>
              My bookings
            </Button>
          </div>
        </GlassPanel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassPanel className="p-3.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <strong className="flex items-center gap-1.5 text-sm">
              <Percent className="size-4 text-[var(--hos-primary)]" />
              Rates &amp; MoU cards
            </strong>
            <Button size="sm" variant="ghost" className="!rounded-full" onClick={() => onOpenTab("rates")}>
              Full rate card
            </Button>
          </div>
          {activeHotels.length === 0 ? (
            <p className="m-0 text-[11px] text-[var(--hos-ink-3)]">No active MoU rate cards.</p>
          ) : (
            <ul className="m-0 list-none space-y-2 p-0">
              {activeHotels.map((h) => (
                <li
                  key={`rate-${h.mouId}`}
                  className="hos-luxury-card flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                >
                  <div>
                    <div className="text-sm font-semibold text-[var(--hos-ink)]">{h.propertyName}</div>
                    <div className="text-[11px] text-[var(--hos-ink-3)]">
                      Card {h.rateCardCode} · credit {formatNu(h.creditLimitBtn)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-bold tabular-nums">
                      {h.doubleNet != null ? formatNu(h.doubleNet) : "—"}
                    </div>
                    <div className="text-[10px] text-[var(--hos-ink-3)]">double net / night</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>

        <GlassPanel className="p-3.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <strong className="flex items-center gap-1.5 text-sm">
              <Wallet className="size-4 text-[var(--hos-primary)]" />
              Offers &amp; allotments
            </strong>
            <Button size="sm" variant="ghost" className="!rounded-full" onClick={() => onOpenTab("book")}>
              Book hold
            </Button>
          </div>
          {offers.length === 0 ? (
            <EmptyState
              title="No open offers"
              description="Hotel allotment blocks and MoU offers appear here when placed."
            />
          ) : (
            <ul className="m-0 max-h-[240px] list-none space-y-1.5 overflow-auto p-0">
              {offers.slice(0, 12).map((o) => (
                <li
                  key={o.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--hos-line)] px-2.5 py-2 text-[11px]"
                >
                  <span>
                    <Badge tone="vip">{o.kind}</Badge>{" "}
                    <span className="font-semibold">{o.typeCode}</span> · {o.propertyName}
                    <span className="text-[var(--hos-ink-3)]">
                      {" "}
                      · {o.from} → {o.to}
                    </span>
                  </span>
                  <span className="font-mono tabular-nums">{formatNu(o.netRateBtn)}/n</span>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}
