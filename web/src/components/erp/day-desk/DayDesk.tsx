"use client";

import { bulkCheckInBookings, bulkCheckOutBookings } from "@/app/actions/erp-day-bulk";
import { recordExtraMeal, recordGuestRequest } from "@/app/actions/erp-day-desk";
import { OccupancyRange } from "@/components/erp/OccupancyRange";
import { useStayHubOptional } from "@/components/erp/StayHubProvider";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { seedStayFromBoardRow } from "@/lib/folio/stay-hub-seed";
import type { OccupancyNight } from "@/lib/erp/occupancy-nights";
import type { GuestRequestLine } from "@/lib/erp/guest-requests";
import { formatBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import type { ColumnDef, FilterFn } from "@tanstack/react-table";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

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

type StayJob = "arrival" | "departure" | "bill" | "house";

const stayFilter: FilterFn<DayStayRow> = (row, _columnId, filterValue) => {
  const q = String(filterValue ?? "").trim().toLowerCase();
  if (!q) return true;
  const stay = row.original;
  return [stay.room, stay.guest, stay.agent, stay.nationality, stay.meal, stay.guide, stay.guidePhone]
    .join(" ")
    .toLowerCase()
    .includes(q);
};

function seedStay(row: DayStayRow) {
  return seedStayFromBoardRow({
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
  });
}

function DueAmount({ amount }: { amount: number | null }) {
  if (amount == null) return <span className="text-muted-foreground">—</span>;
  const unpaid = amount > 0.5;
  return (
    <span className={cn("tabular-nums", unpaid && "font-semibold text-destructive")}>
      {formatBtn(amount)}
    </span>
  );
}

export type GuideRow = {
  movement: "arrival" | "departure";
  when: "Today" | "Tomorrow";
  name: string;
  phone: string;
  number: string;
  agent: string;
  visits: number | null;
  rooms: string;
  guests: string;
  heads: number;
  meal: string;
  lastSeen: string;
};

const guideColumns: ColumnDef<GuideRow>[] = [
  {
    id: "when",
    accessorFn: (row) => row.when,
    header: "Day",
    meta: { className: "w-24" },
    cell: ({ row }) => row.original.when,
  },
  {
    id: "guide",
    accessorFn: (row) => row.name,
    header: "Guide",
    cell: ({ row }) =>
      row.original.name ? (
        <span className="font-medium">{row.original.name}</span>
      ) : (
        <span className="text-muted-foreground">Not written</span>
      ),
  },
  {
    id: "phone",
    accessorFn: (row) => row.phone,
    header: "Phone",
    cell: ({ row }) =>
      row.original.phone ? (
        <a className="text-sky-800" href={`tel:${row.original.phone}`}>
          {row.original.phone}
        </a>
      ) : (
        <span className="text-muted-foreground">No number</span>
      ),
  },
  {
    id: "agent",
    accessorFn: (row) => row.agent,
    header: "Agent",
    cell: ({ row }) => row.original.agent || <span className="text-muted-foreground">Direct</span>,
  },
  {
    id: "visits",
    accessorFn: (row) => row.visits ?? -1,
    header: "Visits",
    meta: { className: "w-16 text-right", headerClassName: "text-right" },
    cell: ({ row }) => (
      <span className="tabular-nums">
        {row.original.visits == null ? "—" : row.original.visits}
      </span>
    ),
  },
  {
    id: "rooms",
    accessorFn: (row) => row.rooms,
    header: "Rooms",
    cell: ({ row }) => <span className="tabular-nums">{row.original.rooms || "—"}</span>,
  },
  {
    id: "guests",
    accessorFn: (row) => `${row.guests} ${row.heads}`,
    header: "Guests",
    cell: ({ row }) => (
      <span>
        {row.original.guests || "—"}
        {row.original.heads > 0 ? (
          <span className="ml-1 text-xs text-muted-foreground tabular-nums">{row.original.heads}</span>
        ) : null}
      </span>
    ),
  },
  {
    id: "meal",
    accessorFn: (row) => row.meal,
    header: "Meal",
    cell: ({ row }) => row.original.meal || "—",
  },
  {
    id: "number",
    accessorFn: (row) => row.number,
    header: "Number",
    cell: ({ row }) =>
      row.original.number ? (
        <span className="font-mono text-xs">{row.original.number}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: "last",
    accessorFn: (row) => row.lastSeen,
    header: "Last visit",
    cell: ({ row }) => row.original.lastSeen || <span className="text-muted-foreground">—</span>,
  },
];

function StayTable({
  rows,
  empty,
  job,
  title,
  extra,
  selectedIds,
  onSelectedChange,
}: {
  rows: DayStayRow[];
  empty: string;
  job: StayJob;
  title: string;
  extra?: ReactNode;
  selectedIds?: string[];
  onSelectedChange?: (ids: string[]) => void;
}) {
  const stayHub = useStayHubOptional();
  const openStay = (row: DayStayRow) => {
    const step = job === "arrival" ? "check_in" : job === "house" ? "stay_money" : "check_out";
    const board = job === "arrival" ? "arrivals" : job === "house" ? "in_house" : "departures";
    stayHub?.openStayHub({
      bookingId: row.id,
      step,
      board,
      seedStay: seedStay(row),
    });
  };

  const columns: ColumnDef<DayStayRow>[] = [];
  if (onSelectedChange) {
    const picked = new Set(selectedIds ?? []);
    columns.push({
      id: "pick",
      header: "",
      enableSorting: false,
      meta: { className: "w-8", headerClassName: "w-8" },
      cell: ({ row }) => (
        <input
          type="checkbox"
          className="size-4"
          checked={picked.has(row.original.id)}
          aria-label={`Select ${row.original.guest}`}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            const next = new Set(picked);
            if (event.target.checked) next.add(row.original.id);
            else next.delete(row.original.id);
            onSelectedChange([...next]);
          }}
        />
      ),
    });
  }
  columns.push(
    {
      id: "room",
      accessorFn: (row) => row.room,
      header: "Room",
      meta: { className: "w-[7rem] whitespace-nowrap", headerClassName: "w-[7rem]" },
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">{row.original.room || "—"}</span>
      ),
    },
    {
      id: "guest",
      accessorFn: (row) => row.guest,
      header: "Guest",
      cell: ({ row }) => (
        <div className="min-w-[10rem]">
          <p className="font-medium">{row.original.guest}</p>
          {row.original.nationality ? (
            <p className="text-xs text-muted-foreground">{row.original.nationality}</p>
          ) : null}
        </div>
      ),
    },
    {
      id: "agent",
      accessorFn: (row) => row.agent,
      header: "Agent",
      cell: ({ row }) => row.original.agent || <span className="text-muted-foreground">—</span>,
    },
    {
      id: "heads",
      accessorFn: (row) => row.heads,
      header: "Pax",
      meta: { className: "w-[4rem] text-right", headerClassName: "w-[4rem]" },
      cell: ({ row }) => <span className="tabular-nums">{row.original.heads}</span>,
    },
    {
      id: "meal",
      accessorFn: (row) => row.meal,
      header: "Meal",
      cell: ({ row }) => row.original.meal || "—",
    },
    {
      id: "guide",
      accessorFn: (row) => row.guide,
      header: "Guide",
      cell: ({ row }) => (
        <div className="min-w-[8rem]">
          <p>{row.original.guide || "—"}</p>
          {row.original.guidePhone ? (
            <a className="text-xs text-sky-800" href={`tel:${row.original.guidePhone}`}>
              {row.original.guidePhone}
            </a>
          ) : null}
        </div>
      ),
    },
  );

  if (job !== "house") {
    columns.push({
      id: "due",
      accessorFn: (row) => row.balance ?? 0,
      header: "Due",
      meta: { className: "text-right", headerClassName: "text-right" },
      cell: ({ row }) => <DueAmount amount={row.original.balance} />,
    });
  }

  if (job === "house") {
    columns.push(
      {
        id: "laundry",
        accessorFn: (row) => row.laundry,
        header: "Laundry",
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.laundry || "—"}</span>
        ),
      },
      {
        id: "requests",
        header: "Requests",
        cell: ({ row }) => <HouseRequests row={row.original} />,
      },
    );
  }

  columns.push({
    id: "actions",
    header: job === "arrival" ? "Check in" : "Bill",
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {job === "arrival" ? (
          <Button type="button" size="sm" variant="outline" onClick={() => openStay(row.original)}>
            Check in
          </Button>
        ) : null}
        {row.original.folioId && job !== "arrival" ? (
          <Button asChild size="sm" variant={row.original.hasInvoice ? "outline" : "default"}>
            <a href={`/erp/folios/${row.original.folioId}/bill`}>
              {row.original.hasInvoice ? "Print bill" : "Open bill"}
            </a>
          </Button>
        ) : null}
        {job === "departure" || job === "bill" ? (
          <Button type="button" size="sm" variant="outline" onClick={() => openStay(row.original)}>
            Check out
          </Button>
        ) : null}
        {job === "house" ? (
          <Button type="button" size="sm" variant="outline" onClick={() => openStay(row.original)}>
            Correct
          </Button>
        ) : null}
      </div>
    ),
  });

  return (
    <DataTable
      columns={columns}
      data={rows}
      pageSize={80}
      searchable
      searchPlaceholder="Room, guest, agent"
      emptyMessage={empty}
      caption={title}
      className="space-y-2"
      globalFilterFn={stayFilter}
      onRowClick={openStay}
      toolbar={
        <div className="mr-auto flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">{title}</h2>
          {extra}
        </div>
      }
    />
  );
}

function HouseRequests({ row }: { row: DayStayRow }) {
  return (
    <div className="min-w-[16rem]">
      {row.requests.length ? (
        <ul className="mb-1 text-xs">
          {row.requests.map((request, index) => (
            <li key={`${row.id}-${index}`} className={cn(request.done && "line-through")}>
              {request.text}
            </li>
          ))}
        </ul>
      ) : null}
      <form action={recordGuestRequest} className="flex gap-1">
        <input type="hidden" name="booking_id" value={row.id} />
        <input
          name="request"
          aria-label={`Request for ${row.guest}`}
          placeholder="Request"
          className="h-8 w-36 rounded-md border px-2 text-xs"
        />
        <Button type="submit" size="sm" variant="outline">
          Save
        </Button>
      </form>
      <form action={recordExtraMeal} className="mt-1 flex flex-wrap gap-1">
        <input type="hidden" name="booking_id" value={row.id} />
        <input type="hidden" name="night" value={row.checkIn ?? ""} />
        <select name="meal" aria-label="Extra meal" className="h-8 rounded-md border px-1 text-xs">
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
          className="h-8 w-14 rounded-md border px-1 text-xs"
        />
        <input
          name="amount"
          inputMode="decimal"
          placeholder="Nu"
          aria-label="Amount if the rate is set"
          className="h-8 w-16 rounded-md border px-1 text-xs"
        />
        <Button type="submit" size="sm" variant="outline">
          Meal
        </Button>
      </form>
    </div>
  );
}

function CountTable({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { label: string; count: number }[];
  empty: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {rows.length ? (
        <table className="mt-1 w-full text-sm">
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t">
                <td className="py-1">{row.label}</td>
                <td className="py-1 text-right tabular-nums">{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

export function DayDesk({
  dateLabel,
  inHouseCount,
  roomsTotal = 0,
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
  /** Guest rooms in the hotel. Shown next to today's occupied count. */
  roomsTotal?: number;
  inHouseHeads: number;
  arrivals: number;
  departures: number;
  tomorrowDepartures: number;
  meals: { code: string; heads: number }[];
  nationalities: { name: string; heads: number }[];
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
  guides: GuideRow[];
}) {
  const summary = `Pelbu day ${dateLabel}. ${inHouseCount} rooms in house, ${inHouseHeads} guests. Arrivals ${arrivals}. Departures ${departures}.`;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(summary)}`;
  const billRows = departureRows.filter((row) => row.folioId && !row.hasInvoice);
  const [mixOpen, setMixOpen] = useState(false);
  const [sheet, setSheet] = useState<DaySheet>("arrivals");
  const [guideMove, setGuideMove] = useState<"arrival" | "departure">("arrival");
  const [pickedIn, setPickedIn] = useState<string[]>([]);
  const [pickedOut, setPickedOut] = useState<string[]>([]);
  const [pending, startBulk] = useTransition();
  const mealLabel = meals[0] ? `${meals[0].code} ${meals[0].heads}` : "—";
  const passes = [
    { href: "/erp/day/arrivals/print", label: "Arrival sheet" },
    { href: "/erp/day/pass/hk/print", label: "Housekeeping" },
    { href: "/erp/day/pass/kitchen/print", label: "Kitchen" },
    { href: "/erp/day/pass/fnb/print", label: "F&B" },
    { href: "/erp/day/pass/fo/print", label: "Front office" },
  ];
  const tabs: { id: DaySheet; label: string; count: number }[] = [
    { id: "arrivals", label: "Arrivals", count: arrivalRows.length },
    { id: "departures", label: "Departures", count: departureRows.length },
    { id: "bills", label: "Bills", count: missingInvoices },
    { id: "house", label: "In house", count: inHouse.length },
    { id: "tomorrow", label: "Tomorrow", count: tomorrowRows.length },
    { id: "guides", label: "Guides", count: guides.length },
  ];

  function runBulk(kind: "in" | "out") {
    const pool = kind === "in" ? arrivalRows : departureRows;
    const picked = kind === "in" ? pickedIn : pickedOut;
    const ids = picked.length ? picked : pool.map((row) => row.id);
    if (!ids.length) {
      toast.message(kind === "in" ? "No arrivals to check in." : "No departures to check out.");
      return;
    }
    startBulk(async () => {
      const result =
        kind === "in" ? await bulkCheckInBookings(ids) : await bulkCheckOutBookings(ids);
      if (result.done.length) toast.success(result.message ?? "Saved");
      if (result.failed.length) {
        toast.error(result.failed.map((row) => `${row.name}: ${row.error}`).slice(0, 4).join(" · "));
      } else if (!result.ok) {
        toast.error(result.error ?? "Nothing changed");
      }
      if (kind === "in") setPickedIn([]);
      else setPickedOut([]);
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-nowrap items-center gap-2 border-b px-2 py-1">
        <h1 className="shrink-0 px-1 text-sm font-semibold whitespace-nowrap">Day · {dateLabel}</h1>
        <OccupancyRange from={from} to={to} nights={nights} action="/erp/day" focusDate={from} dates="dialog" />
        <div className="flex min-w-0 flex-1 overflow-hidden rounded-lg border bg-card">
          <FigureBox label="Rooms" value={roomsTotal > 0 ? `${inHouseCount}/${roomsTotal}` : String(inHouseCount)} tone="text-sky-700" onClick={() => setSheet("house")} />
          <FigureBox label="Guests" value={String(inHouseHeads)} tone="text-amber-700" onClick={() => setSheet("house")} />
          <FigureBox label="To collect" value={formatBtn(toCollect)} tone="text-rose-700" onClick={() => setSheet("departures")} />
          <FigureBox label="Takings" value={formatBtn(takings)} tone="text-emerald-700" href="/erp/payments" />
          <FigureBox label="Tomorrow" value={String(tomorrowDepartures)} tone="text-violet-700" onClick={() => setSheet("tomorrow")} />
          <FigureBox label="Open bills" value={String(openBills)} tone="text-orange-700" onClick={() => setSheet("bills")} />
          <FigureBox label="Meals" value={mealLabel} tone="text-teal-700" onClick={() => setMixOpen(true)} />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-auto shrink-0 items-center gap-1 rounded-lg border bg-card px-3 py-1 text-left hover:bg-muted/60">
            <span>
              <span className="block text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Passes
              </span>
              <span className="block text-sm font-semibold">Print</span>
            </span>
            <ChevronDown className="size-3.5 opacity-70" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {passes.map((pass) => (
              <DropdownMenuItem key={pass.href} asChild>
                <a href={pass.href}>{pass.label}</a>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <a
          href={whatsapp}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 flex-col justify-center rounded-lg border bg-card px-3 py-1 hover:bg-muted/60"
        >
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Send</span>
          <span className="text-sm font-semibold">WhatsApp</span>
        </a>
        <Dialog open={mixOpen} onOpenChange={setMixOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>In house · {dateLabel}</DialogTitle>
              <DialogDescription>
                {inHouseCount} rooms, {inHouseHeads} guests.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <CountTable
                title="Meals"
                rows={meals.map((row) => ({ label: row.code, count: row.heads }))}
                empty="No meal plan on the in-house stays."
              />
              <CountTable
                title="Nationality"
                rows={nationalities.map((row) => ({ label: row.name, count: row.heads }))}
                empty="Nationality is not written."
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
        {sheet === "arrivals" ? (
          <StayTable
            rows={arrivalRows}
            empty="No arrivals today."
            job="arrival"
            title="Arrivals"
            selectedIds={pickedIn}
            onSelectedChange={setPickedIn}
            extra={
              <Button type="button" size="sm" disabled={pending} onClick={() => runBulk("in")}>
                {pending ? "Checking in…" : pickedIn.length ? `Check in ${pickedIn.length}` : "Check in all"}
              </Button>
            }
          />
        ) : null}
        {sheet === "departures" ? (
          <StayTable
            rows={departureRows}
            empty="No departures today."
            job="departure"
            title="Departures"
            selectedIds={pickedOut}
            onSelectedChange={setPickedOut}
            extra={
              <>
                <Button type="button" size="sm" disabled={pending} onClick={() => runBulk("out")}>
                  {pending ? "Checking out…" : pickedOut.length ? `Check out ${pickedOut.length}` : "Check out all"}
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href="/erp/folios/group/print">Print group bills</a>
                </Button>
              </>
            }
          />
        ) : null}
        {sheet === "bills" ? (
          <StayTable rows={billRows} empty="Every departure already has a bill." job="bill" title="Bills to print" />
        ) : null}
        {sheet === "house" ? (
          <StayTable rows={inHouse} empty="No one in house." job="house" title="In house" />
        ) : null}
        {sheet === "tomorrow" ? (
          <StayTable rows={tomorrowRows} empty="No departures tomorrow." job="departure" title="Tomorrow" />
        ) : null}
        {sheet === "guides" ? (
          <DataTable
            columns={guideColumns}
            data={guides.filter((row) => row.movement === guideMove)}
            pageSize={80}
            searchable
            searchPlaceholder="Guide, agent, or guest"
            emptyMessage={
              guideMove === "arrival"
                ? "No guides on today’s or tomorrow’s arrivals."
                : "No guides on today’s or tomorrow’s departures."
            }
            caption="Guides to call"
            className="space-y-2"
            toolbar={
              <div className="mr-auto flex items-center gap-1 rounded-md border bg-[#f6f1ea] p-0.5">
                {(["arrival", "departure"] as const).map((move) => {
                  const count = guides.filter((row) => row.movement === move).length;
                  const on = guideMove === move;
                  return (
                    <button
                      key={move}
                      type="button"
                      onClick={() => setGuideMove(move)}
                      className={cn(
                        "h-7 rounded px-3 text-xs",
                        on ? "bg-[#1a1410] font-semibold text-[#f6f1ea]" : "text-muted-foreground",
                      )}
                    >
                      {move === "arrival" ? "Arrival" : "Departure"}
                      <span className="ml-1 tabular-nums">{count}</span>
                    </button>
                  );
                })}
              </div>
            }
          />
        ) : null}
      </div>
      <nav className="print-hide flex shrink-0 items-end gap-0.5 overflow-x-auto border-t bg-[#e7e0d6] px-2 pt-1" aria-label="Day sheets">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSheet(tab.id)}
            className={cn(
              "h-8 shrink-0 rounded-t-md border border-b-0 px-3 text-xs",
              sheet === tab.id
                ? "bg-background font-semibold text-foreground"
                : "bg-[#f6f1ea]/70 text-muted-foreground hover:bg-background/80",
            )}
          >
            {tab.label}
            <span className="ml-1 tabular-nums">{tab.count}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

type DaySheet = "arrivals" | "departures" | "bills" | "house" | "tomorrow" | "guides";

function FigureBox({
  label,
  value,
  href,
  onClick,
  tone,
}: {
  label: string;
  value: string;
  href?: string;
  onClick?: () => void;
  tone: string;
}) {
  const className =
    "min-w-0 flex-1 border-r px-2 py-1 text-left last:border-r-0 hover:bg-muted/60";
  const inner = (
    <>
      <span className="block truncate text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span className={cn("block truncate text-sm font-semibold tabular-nums", tone)}>{value}</span>
    </>
  );
  if (href) {
    return (
      <a href={href} className={className}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick}>
      {inner}
    </button>
  );
}
