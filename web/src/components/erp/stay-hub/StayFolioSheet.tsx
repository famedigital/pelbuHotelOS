"use client";

import { saveStayNightMeals, loadStayNightMeals } from "@/app/actions/erp-night-meals";
import { applyStayRate, loadStayRateOffers } from "@/app/actions/erp-stay-rate";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRoomBillDate, stayNightDates, stayNights } from "@/lib/folio/room-bill";
import { folioNoFromConfirmation } from "@/lib/hotel-doc-no";
import { formatGuestBtn } from "@/lib/pricing";
import { offerListLabel, type RateOfferView } from "@/lib/rates/rate-offer-label";
import { useActionState, useEffect, useState, type ReactNode } from "react";

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

  return (
    <Card className="gap-3 py-3 shadow-none">
      <CardContent className="space-y-3 px-3">
        <p className="text-xs text-muted-foreground">
          {folioDocNo || folioNoFromConfirmation(confirmationCode) || "Room bill"}
        </p>
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Room</TableHead>
                <TableHead>In</TableHead>
                <TableHead>Out</TableHead>
                <TableHead>Nights</TableHead>
                <TableHead>Guests</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={`${row.room}-${index}`}>
                  <TableCell>{row.room}</TableCell>
                  <TableCell className="tabular-nums">{checkIn.slice(5)}</TableCell>
                  <TableCell className="tabular-nums">{checkOut.slice(5)}</TableCell>
                  <TableCell className="tabular-nums">{nights}</TableCell>
                  <TableCell className="tabular-nums">{guests}</TableCell>
                  <TableCell className="tabular-nums">
                    {row.rate != null ? formatGuestBtn(row.rate) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.amount != null ? formatGuestBtn(row.amount) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={6}>Total</TableCell>
                <TableCell className="text-right tabular-nums">
                  {hasAmount ? formatGuestBtn(total) : "—"}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
        <ul className="space-y-2 md:hidden">
          {rows.map((row, index) => (
            <li key={`${row.room}-${index}`}>
              <Card className="gap-1 py-3 shadow-none">
                <CardContent className="space-y-1 px-3 text-sm">
                  <p className="font-medium">{row.room}</p>
                  <p className="text-muted-foreground">
                    {checkIn.slice(5)} → {checkOut.slice(5)} · {nights} nights · {guests} guests
                  </p>
                  <p className="tabular-nums">
                    {row.rate != null ? formatGuestBtn(row.rate) : "Rate —"}
                    {row.amount != null ? ` · ${formatGuestBtn(row.amount)}` : ""}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
        <NightMealEditor
          bookingId={bookingId}
          checkIn={checkIn}
          checkOut={checkOut}
          defaultMeal={mealPlanCode}
          mealPlans={mealPlans ?? []}
          onSaved={onSaved}
        />
        <FolioRatePicker bookingId={bookingId} />
        {footer}
      </CardContent>
    </Card>
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
  onSaved,
}: {
  bookingId: string;
  checkIn: string;
  checkOut: string;
  defaultMeal?: string | null;
  mealPlans: Array<{ code: string; name: string }>;
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
  const [pending, startSave] = useState(false);
  const [state, setState] = useState<{ ok: boolean; error?: string; message?: string }>({
    ok: false,
  });

  useEffect(() => {
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
    });
    return () => {
      cancelled = true;
    };
  }, [bookingId, checkIn, checkOut, fallback]);

  if (dates.length === 0) return null;
  const chosen = dates.map((date) => ({
    date,
    mealPlanCode: meals[date] || fallback,
    rooms: (rooms[date] ?? []).map((room) => ({
      roomUnitId: room.roomUnitId,
      rateBtn: rates[`${date}:${room.roomUnitId}`] ?? "",
    })),
  }));

  return (
    <form
      className="space-y-2 border-t pt-3"
      onSubmit={(event) => {
        event.preventDefault();
        const body = new FormData(event.currentTarget);
        startSave(true);
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
          .finally(() => startSave(false));
      }}
    >
      <input type="hidden" name="booking_id" value={bookingId} />
      <input type="hidden" name="nights_json" value={JSON.stringify(chosen)} />
      <p className="text-xs text-muted-foreground">Each night</p>
      <ul className="space-y-2">
        {dates.map((date) => {
          const nightRooms = rooms[date] ?? [];
          return (
            <li key={date} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-sm tabular-nums">
                  {formatRoomBillDate(date).replace(/ \d{4}$/, "")}
                </span>
                <Select
                  value={meals[date] || fallback}
                  onValueChange={(code) =>
                    setMeals((current) => ({ ...current, [date]: code }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((plan) => (
                      <SelectItem key={plan.code} value={plan.code}>
                        {plan.code} · {plan.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {nightRooms.length === 0 ? (
                <p className="pl-16 text-xs text-muted-foreground">No room on this night.</p>
              ) : (
                nightRooms.map((room) => (
                  <label
                    key={room.roomUnitId}
                    className="flex items-center gap-2 pl-16"
                  >
                    <span className="w-12 shrink-0 text-sm tabular-nums">
                      {room.label}
                    </span>
                    <Input
                      inputMode="decimal"
                      className="text-base tabular-nums"
                      aria-label={`Rate for room ${room.label} on ${date}`}
                      value={rates[`${date}:${room.roomUnitId}`] ?? ""}
                      onChange={(event) =>
                        setRates((current) => ({
                          ...current,
                          [`${date}:${room.roomUnitId}`]: event.target.value,
                        }))
                      }
                    />
                  </label>
                ))
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-end gap-2">
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
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save nights"}
        </Button>
      </div>
      {state.error ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : state.message ? (
        <p className="text-xs text-muted-foreground">{state.message}</p>
      ) : null}
    </form>
  );
}
