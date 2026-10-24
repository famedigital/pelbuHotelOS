"use client";

import { recordExtraMeal, recordGuestRequest } from "@/app/actions/erp-day-desk";
import { OccupancyRange } from "@/components/erp/OccupancyRange";
import { useStayHubOptional } from "@/components/erp/StayHubProvider";
import { seedStayFromBoardRow } from "@/lib/folio/stay-hub-seed";
import type { OccupancyNight } from "@/lib/erp/occupancy-nights";
import type { GuestRequestLine } from "@/lib/erp/guest-requests";
import { formatBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export type DayStayRow = {
  id: string;
  room: string;
  guest: string;
  agent: string;
  heads: number;
  nationality: string;
  meal: string;
  guide: string;
  guidePhone: string;
  laundry: number;
  requests: GuestRequestLine[];
  balance: number | null;
  folioId: string | null;
  hasInvoice: boolean;
  phone: string | null;
  checkIn: string | null;
  checkOut: string | null;
  status: string | null;
  rooms: number;
  agentId: string | null;
};

function StayTable({
  rows,
  empty,
  showBalance,
}: {
  rows: DayStayRow[];
  empty: string;
  showBalance?: boolean;
}) {
  const stayHub = useStayHubOptional();
  if (!rows.length) {
    return <p className="px-2 py-3 text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[64rem] text-left text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th className="px-2 py-1 font-medium">Room</th>
            <th className="px-2 py-1 font-medium">Guest</th>
            <th className="px-2 py-1 font-medium">Agent</th>
            <th className="px-2 py-1 font-medium">Heads</th>
            <th className="px-2 py-1 font-medium">Nationality</th>
            <th className="px-2 py-1 font-medium">Meal</th>
            <th className="px-2 py-1 font-medium">Guide</th>
            <th className="px-2 py-1 font-medium">Laundry</th>
            <th className="px-2 py-1 font-medium">Requests</th>
            {showBalance ? <th className="px-2 py-1 font-medium">Due</th> : null}
            <th className="px-2 py-1 font-medium"> </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t align-top">
              <td className="px-2 py-1 font-medium tabular-nums">{row.room || "—"}</td>
              <td className="px-2 py-1">{row.guest}</td>
              <td className="px-2 py-1">{row.agent || "—"}</td>
              <td className="px-2 py-1 tabular-nums">{row.heads}</td>
              <td className="px-2 py-1">{row.nationality || "—"}</td>
              <td className="px-2 py-1">{row.meal}</td>
              <td className="px-2 py-1">
                {row.guide || "—"}
                {row.guidePhone ? (
                  <a className="block text-xs text-sky-800" href={`tel:${row.guidePhone}`}>
                    {row.guidePhone}
                  </a>
                ) : null}
              </td>
              <td className="px-2 py-1 tabular-nums">{row.laundry || "—"}</td>
              <td className="px-2 py-1">
                {row.requests.length ? (
                  <ul>
                    {row.requests.map((request) => (
                      <li key={request.text} className={cn(request.done && "line-through")}>
                        {request.text}
                      </li>
                    ))}
                  </ul>
                ) : (
                  "—"
                )}
                <form action={recordGuestRequest} className="mt-1 flex gap-1">
                  <input type="hidden" name="booking_id" value={row.id} />
                  <input
                    name="request"
                    aria-label={`Request for ${row.guest}`}
                    placeholder="Request"
                    className="h-7 w-36 rounded-md border px-2 text-xs"
                  />
                  <button type="submit" className="h-7 rounded-md border px-2 text-xs">
                    Save
                  </button>
                </form>
                <form action={recordExtraMeal} className="mt-1 flex flex-wrap gap-1">
                  <input type="hidden" name="booking_id" value={row.id} />
                  <input type="hidden" name="night" value={row.checkIn ?? ""} />
                  <select name="meal" aria-label="Extra meal" className="h-7 rounded-md border px-1 text-xs">
                    <option>Dinner</option>
                    <option>Breakfast</option>
                    <option>Lunch</option>
                  </select>
                  <input
                    name="heads"
                    type="number"
                    min={1}
                    defaultValue={row.heads}
                    aria-label="Heads"
                    className="h-7 w-14 rounded-md border px-1 text-xs"
                  />
                  <input
                    name="amount"
                    inputMode="decimal"
                    placeholder="Nu"
                    aria-label="Amount if the rate is set"
                    className="h-7 w-16 rounded-md border px-1 text-xs"
                  />
                  <button type="submit" className="h-7 rounded-md border px-2 text-xs">
                    Meal
                  </button>
                </form>
              </td>
              {showBalance ? (
                <td className="px-2 py-1 tabular-nums">
                  {row.balance != null ? formatBtn(row.balance) : "—"}
                  {row.hasInvoice ? "" : " · no invoice"}
                </td>
              ) : null}
              <td className="px-2 py-1">
                <button
                  type="button"
                  className="h-7 rounded-md border px-2 text-xs"
                  onClick={() =>
                    stayHub?.openStayHub({
                      bookingId: row.id,
                      step: "stay_money",
                      board: "in_house",
                      seedStay: seedStayFromBoardRow({
                        id: row.id,
                        contact_name: row.guest,
                        contact_phone: row.phone,
                        check_in: row.checkIn,
                        check_out: row.checkOut,
                        status: row.status,
                        rooms: row.rooms,
                        agent_id: row.agentId,
                        agent_name: row.agent,
                        room_labels: row.room,
                        assigned_count: row.room ? row.room.split(",").length : 0,
                        folio_id: row.folioId,
                        folio_balance: row.balance,
                      }),
                    })
                  }
                >
                  Correct
                </button>
                {row.folioId ? (
                  <a
                    className="ml-1 inline-flex h-7 items-center text-xs text-sky-800"
                    href={`/erp/folios/${row.folioId}/bill`}
                  >
                    Print
                  </a>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DayDesk({
  dateLabel,
  inHouseCount,
  inHouseHeads,
  arrivals,
  departures,
  tomorrowDepartures,
  meals,
  nationalities,
  toCollect,
  takings,
  openBills,
  missingInvoices,
  nights,
  from,
  to,
  inHouse,
  arrivalRows,
  departureRows,
  tomorrowRows,
  guides,
}: {
  dateLabel: string;
  inHouseCount: number;
  inHouseHeads: number;
  arrivals: number;
  departures: number;
  tomorrowDepartures: number;
  meals: string;
  nationalities: string;
  toCollect: number;
  takings: number;
  openBills: number;
  missingInvoices: number;
  nights: OccupancyNight[];
  from: string;
  to: string;
  inHouse: DayStayRow[];
  arrivalRows: DayStayRow[];
  departureRows: DayStayRow[];
  tomorrowRows: DayStayRow[];
  guides: { name: string; phone: string; rooms: number }[];
}) {
  const summary = `Pelbu day ${dateLabel}. In house ${inHouseCount}. Arrivals ${arrivals}. Departures ${departures}.`;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(summary)}`;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-1.5 text-sm">
        <h1 className="font-semibold">Day · {dateLabel}</h1>
        <span>In house {inHouseCount} rooms, {inHouseHeads} heads</span>
        <span>Coming in {arrivals}</span>
        <span>Going out {departures}</span>
        <span>Tomorrow {tomorrowDepartures}</span>
        <span>{meals}</span>
        <span className="min-w-0 truncate">{nationalities}</span>
        <span>To collect {formatBtn(toCollect)}</span>
        <span>Takings {formatBtn(takings)}</span>
        <span>Open bills {openBills}</span>
        <span>No invoice {missingInvoices}</span>
        <a className="rounded-md border px-2 py-0.5" href="/erp/day/pass/hk/print">HK</a>
        <a className="rounded-md border px-2 py-0.5" href="/erp/day/pass/kitchen/print">Kitchen</a>
        <a className="rounded-md border px-2 py-0.5" href="/erp/day/pass/fnb/print">F&B</a>
        <a className="rounded-md border px-2 py-0.5" href="/erp/day/pass/fo/print">Front office</a>
        <a className="rounded-md border px-2 py-0.5" href={whatsapp} target="_blank" rel="noreferrer">
          WhatsApp
        </a>
      </div>
      <div className="border-b px-3 py-1">
        <OccupancyRange from={from} to={to} nights={nights} action="/erp/day" />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <section>
          <h2 className="px-3 py-1 text-xs font-semibold tracking-wide text-muted-foreground">In house</h2>
          <StayTable rows={inHouse} empty="No one in house." />
        </section>
        <section>
          <h2 className="px-3 py-1 text-xs font-semibold tracking-wide text-muted-foreground">Arrivals</h2>
          <StayTable rows={arrivalRows} empty="No arrivals." />
        </section>
        <section>
          <h2 className="px-3 py-1 text-xs font-semibold tracking-wide text-muted-foreground">Going out today</h2>
          <StayTable rows={departureRows} empty="No departures today." showBalance />
        </section>
        <section>
          <h2 className="px-3 py-1 text-xs font-semibold tracking-wide text-muted-foreground">Tomorrow, prepared today</h2>
          <StayTable rows={tomorrowRows} empty="No departures tomorrow." showBalance />
        </section>
        <section className="px-3 py-2">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground">Guides to call</h2>
          {guides.length ? (
            <ul className="text-sm">
              {guides.map((guide) => (
                <li key={`${guide.name}-${guide.phone}`}>
                  {guide.name || "Guide"} · {guide.phone || "no number"} · {guide.rooms} rooms
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No guide numbers on today’s stays.</p>
          )}
        </section>
      </div>
    </div>
  );
}
