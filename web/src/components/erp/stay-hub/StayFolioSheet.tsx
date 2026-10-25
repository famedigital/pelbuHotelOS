"use client";

import { saveStayNightMeals, loadStayNightMeals } from "@/app/actions/erp-night-meals";
import { applyStayRate, loadStayRateOffers } from "@/app/actions/erp-stay-rate";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ColumnDef } from "@tanstack/react-table";
import { formatRoomBillDate, stayNightDates, stayNights } from "@/lib/folio/room-bill";
import { folioNoFromConfirmation } from "@/lib/hotel-doc-no";
import { formatGuestBtn } from "@/lib/pricing";
import { offerListLabel, type RateOfferView } from "@/lib/rates/rate-offer-label";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";

export function StayFolioSheet({
  bookingId,
  roomLines,
  checkIn,
  checkOut,
  adults,
  children,
  agreedNightlyRateBtn,
  folioDocNo,
  confirmationCode,
  mealPlanCode,
  mealPlans,
  footer,
  onSaved,
}: {
  bookingId: string;
  roomLines: Array<{
    roomTypeName: string;
    assignedLabels: string[];
    qty: number;
    agreedNightlyRateBtn?: number | null;
    inventoryKind?: string;
  }>;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  agreedNightlyRateBtn: number | null;
  folioDocNo?: string | null;
  confirmationCode?: string | null;
  mealPlanCode?: string | null;
  mealPlans?: Array<{ code: string; name: string }>;
  footer?: ReactNode;
  onSaved?: () => void;
}) {
  const nights = stayNights(checkIn, checkOut);
  const guests = Math.max(0, adults) + Math.max(0, children);
  const guestLines = roomLines.filter(
    (line) => !line.inventoryKind || line.inventoryKind === "sellable_guest",
  );
  const lines = guestLines.length > 0 ? guestLines : roomLines;
  const rows = (lines.length > 0 ? lines : [{
    roomTypeName: "Room",
    assignedLabels: [] as string[],
    qty: 1,
    agreedNightlyRateBtn,
  }]).map((line) => {
    const rate = line.agreedNightlyRateBtn ?? agreedNightlyRateBtn;
    const rooms = Math.max(1, line.qty || 1);
    const amount = rate != null ? Math.round(rate * nights * rooms) : null;
    const room = [line.roomTypeName, line.assignedLabels.filter(Boolean).join(", ")]
      .filter(Boolean)
      .join(" ");
    return { room, rooms, rate, amount };
  });
  const total = rows.reduce((sum, row) => sum + (row.amount ?? 0), 0);
  const hasAmount = rows.some((row) => row.amount != null);

  const folio = folioDocNo || folioNoFromConfirmation(confirmationCode) || "Room bill";
  const guestWord = guests === 1 ? "guest" : "guests";

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--brass-hairline)] bg-[var(--ivory-soft)]">
      <div className="flex items-end justify-between gap-3 border-b border-[var(--brass-hairline)] bg-[var(--ivory-deep)] px-3 py-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--brass)] uppercase">Folio</p>
          <p className="truncate text-sm font-semibold text-[var(--espresso)]">{folio}</p>
        </div>
        <p className="shrink-0 text-right text-base font-semibold tabular-nums text-[var(--espresso)]">
          {hasAmount ? formatGuestBtn(total) : "—"}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5 px-3 py-2">
        <Fact tone="ink">{checkIn.slice(5)} → {checkOut.slice(5)}</Fact>
        <Fact tone="brass">{nights} {nights === 1 ? "night" : "nights"}</Fact>
        <Fact tone="ink">{guests} {guestWord}</Fact>
        {mealPlanCode ? <Fact tone="gold">{mealPlanCode}</Fact> : null}
      </div>
      <div className="space-y-2 px-3 pb-3">
        <NightMealEditor
          bookingId={bookingId}
          checkIn={checkIn}
          checkOut={checkOut}
          defaultMeal={mealPlanCode}
          mealPlans={mealPlans ?? []}
          stayLabel={rows[0]?.room || "Room"}
          stayRate={rows[0]?.rate ?? agreedNightlyRateBtn}
          onSaved={onSaved}
        />
        <FolioRatePicker bookingId={bookingId} />
        {footer}
      </div>
    </div>
  );
}

function Fact({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "ink" | "brass" | "gold";
}) {
  const toneClass =
    tone === "brass"
      ? "bg-[var(--brass)] text-[var(--ivory)]"
      : tone === "gold"
        ? "bg-[var(--gold-soft)] text-[var(--espresso)]"
        : "bg-white text-[var(--espresso)]";
  return (
    <span className={`inline-flex h-6 items-center rounded-full border border-[var(--brass-hairline)] px-2 text-[11px] font-medium tabular-nums ${toneClass}`}>
      {children}
    </span>
  );
}

function FolioRatePicker({ bookingId }: { bookingId: string }) {
  const [offers, setOffers] = useState<RateOfferView[]>([]);
  const [rateId, setRateId] = useState("");
  const [state, action, pending] = useActionState(applyStayRate, { ok: false });

  useEffect(() => {
    let cancelled = false;
    void loadStayRateOffers(bookingId).then((result) => {
      if (cancelled || !result.ok) return;
      setOffers(result.offers);
      setRateId((current) => current || result.offers[0]?.id || "");
    });
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  if (offers.length === 0) return null;

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="booking_id" value={bookingId} />
      <input type="hidden" name="room_rate_id" value={rateId} />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs text-muted-foreground">Rate</p>
        <Select value={rateId} onValueChange={setRateId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose a rate" />
          </SelectTrigger>
          <SelectContent>
            {offers.map((offer) => (
              <SelectItem key={offer.id} value={offer.id}>
                {offerListLabel(offer)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-28 space-y-1">
        <p className="text-xs text-muted-foreground">Manager PIN</p>
        <Input
          name="manager_pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          className="text-base"
          placeholder="If asked"
        />
      </div>
      <Button type="submit" disabled={pending || !rateId}>
        {pending ? "Drawing…" : "Use rate"}
      </Button>
      {state.error ? (
        <p className="w-full text-xs text-destructive">{state.error}</p>
      ) : state.message ? (
        <p className="w-full text-xs text-muted-foreground">{state.message}</p>
      ) : null}
    </form>
  );
}

const FALLBACK_MEALS = [
  { code: "EP", name: "Room only" },
  { code: "BB", name: "Breakfast" },
  { code: "CP", name: "Breakfast" },
  { code: "MAP", name: "Breakfast and dinner" },
  { code: "AP", name: "All meals" },
];

function NightMealEditor({
  bookingId,
  checkIn,
  checkOut,
  defaultMeal,
  mealPlans,
  stayLabel,
  stayRate,
  onSaved,
}: {
  bookingId: string;
  checkIn: string;
  checkOut: string;
  defaultMeal?: string | null;
  mealPlans: Array<{ code: string; name: string }>;
  stayLabel: string;
  stayRate: number | null;
  onSaved?: () => void;
}) {
  const dates = stayNightDates(checkIn, checkOut);
  const fallback = (defaultMeal ?? "EP").toUpperCase();
  const options = mealPlans.length > 0 ? mealPlans : FALLBACK_MEALS;
  const [meals, setMeals] = useState<Record<string, string>>({});
  const [rooms, setRooms] = useState<
    Record<string, Array<{ roomUnitId: string; label: string; rateBtn: number | null }>>
  >({});
  const [rates, setRates] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<{ ok: boolean; error?: string; message?: string }>({
    ok: false,
  });
  const ready = useRef(false);
  const pinRef = useRef<HTMLInputElement>(null);
  const latest = useRef({ meals, rates, rooms });
  latest.current = { meals, rates, rooms };

  useEffect(() => {
    ready.current = false;
    const nights = stayNightDates(checkIn, checkOut);
    let cancelled = false;
    void loadStayNightMeals(bookingId).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setState({ ok: false, error: result.error });
        return;
      }
      const nextMeals: Record<string, string> = {};
      const nextRooms: typeof rooms = {};
      const nextRates: Record<string, string> = {};
      for (const date of nights) {
        const night = result.nights.find((row) => row.date === date);
        nextMeals[date] = night?.mealPlanCode || fallback;
        nextRooms[date] = night?.rooms ?? [];
        for (const room of night?.rooms ?? []) {
          nextRates[`${date}:${room.roomUnitId}`] =
            room.rateBtn == null ? "" : String(room.rateBtn);
        }
      }
      setMeals(nextMeals);
      setRooms(nextRooms);
      setRates(nextRates);
      ready.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, [bookingId, checkIn, checkOut, fallback]);

  function queueSave() {
    if (!ready.current) return;
    window.setTimeout(() => {
      if (!ready.current) return;
      const snap = latest.current;
      const body = new FormData();
      body.set("booking_id", bookingId);
      body.set("manager_pin", pinRef.current?.value ?? "");
      body.set(
        "nights_json",
        JSON.stringify(
          dates.map((date) => ({
            date,
            mealPlanCode: snap.meals[date] || fallback,
            rooms: (snap.rooms[date] ?? []).map((room) => ({
              roomUnitId: room.roomUnitId,
              rateBtn: snap.rates[`${date}:${room.roomUnitId}`] ?? "",
            })),
          })),
        ),
      );
      setPending(true);
      void saveStayNightMeals({ ok: false }, body)
        .then((result) => {
          setState(result);
          if (result.ok) onSaved?.();
        })
        .catch((err: unknown) => {
          setState({
            ok: false,
            error: err instanceof Error ? err.message : "Could not save.",
          });
        })
        .finally(() => setPending(false));
    }, 300);
  }

  if (dates.length === 0) return null;
  const mealName = (code: string) => {
    const plan = options.find((item) => item.code === code);
    if (!plan) return code;
    if (plan.name && !plan.name.toUpperCase().startsWith(plan.code)) return plan.name;
    return plan.name || plan.code;
  };
  const nightLabel = (date: string) => formatRoomBillDate(date).replace(/ \d{4}$/, "");
  const lines: Array<{ key: string; roomUnitId: string; label: string; date: string; editable: boolean }> = [];
  const seen = new Map<string, string>();
  for (const date of dates) {
    for (const room of rooms[date] ?? []) {
      if (!seen.has(room.roomUnitId)) seen.set(room.roomUnitId, room.label);
    }
  }
  if (seen.size === 0) {
    for (const date of dates) {
      lines.push({ key: `stay:${date}`, roomUnitId: "", label: stayLabel, date, editable: false });
    }
  } else {
    for (const [roomUnitId, label] of seen) {
      for (const date of dates) {
        if (!(rooms[date] ?? []).some((room) => room.roomUnitId === roomUnitId)) continue;
        lines.push({ key: `${date}:${roomUnitId}`, roomUnitId, label, date, editable: true });
      }
    }
  }

  const columns: ColumnDef<(typeof lines)[number]>[] = [
    {
      id: "room",
      accessorFn: (row) => row.label,
      header: "Room",
      meta: { className: "w-16 font-semibold tabular-nums text-[var(--espresso)]" },
      cell: ({ row }) => row.original.label,
    },
    {
      id: "night",
      accessorFn: (row) => row.date,
      header: "Night",
      cell: ({ row }) => nightLabel(row.original.date),
    },
    {
      id: "meal",
      accessorFn: (row) => meals[row.date] || fallback,
      header: "Meal",
      cell: ({ row }) => {
        const firstOfNight = lines.find((line) => line.date === row.original.date)?.key === row.original.key;
        if (!firstOfNight) {
          return <span className="text-xs text-[var(--espresso-mute)]">{mealName(meals[row.original.date] || fallback)}</span>;
        }
        return (
          <Select
            value={meals[row.original.date] || fallback}
            onValueChange={(code) => {
              setMeals((current) => ({ ...current, [row.original.date]: code }));
              queueSave();
            }}
          >
            <SelectTrigger className="h-8 w-[9.5rem] border-[var(--brass-hairline)] bg-white text-xs" aria-label={`Meal on ${row.original.date}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((plan) => (
                <SelectItem key={plan.code} value={plan.code}>
                  {mealName(plan.code)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      },
    },
    {
      id: "rate",
      accessorFn: (row) => rates[`${row.date}:${row.roomUnitId}`] ?? "",
      header: "Rate",
      meta: { className: "w-28 text-right", headerClassName: "text-right" },
      cell: ({ row }) =>
        row.original.editable ? (
          <Input
            inputMode="decimal"
            className="h-8 border-[var(--brass-hairline)] bg-[var(--ivory-soft)] text-right text-sm tabular-nums text-[var(--espresso)]"
            aria-label={`Rate for room ${row.original.label} on ${row.original.date}`}
            value={rates[`${row.original.date}:${row.original.roomUnitId}`] ?? ""}
            onChange={(event) =>
              setRates((current) => ({
                ...current,
                [`${row.original.date}:${row.original.roomUnitId}`]: event.target.value,
              }))
            }
            onBlur={queueSave}
          />
        ) : (
          <span className="font-medium tabular-nums text-[var(--brass)]">
            {stayRate != null ? formatGuestBtn(stayRate) : "—"}
          </span>
        ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={lines}
      pageSize={40}
      searchable
      searchPlaceholder="Room"
      emptyMessage="No nights on this stay."
      caption="Night rates"
      mobileCards={false}
      className="space-y-2"
      toolbar={
        <div className="mr-auto flex min-w-0 items-center gap-2">
          <Input
            ref={pinRef}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            className="h-8 w-28 border-[var(--brass-hairline)] bg-white text-sm"
            placeholder="PIN if asked"
            aria-label="Manager PIN"
          />
          <p className={state.error && !pending ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
            {pending ? "Saving…" : state.error ? state.error : state.ok ? "Saved" : "Leave a rate to save"}
          </p>
        </div>
      }
    />
  );
}
