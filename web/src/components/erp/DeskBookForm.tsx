"use client";

import {
  createFastBooking,
  type DeskBookIntent,
  type FastBookState,
} from "@/app/actions/fast-book";
import { previewDeskStayQuote } from "@/app/actions/desk-book-preview";
import { AgentPicker, type BookableAgent } from "@/components/erp/AgentPicker";
import {
  CreditAgentPromotePanel,
  needsCreditPromote,
} from "@/components/erp/CreditAgentPromotePanel";
import { StaffPicker, type BookableStaff } from "@/components/erp/StaffPicker";
import type { FastBookRoomType } from "@/components/erp/FastBookForm";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StayDatesField } from "@/components/ui/StayDatesField";
import { useActionToast } from "@/hooks/use-action-toast";
import { idLabel, sdfRequired } from "@/lib/checkin-rules";
import { formatGuestBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { TriangleAlertIcon } from "lucide-react";
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

export type DeskBookFormProps = {
  roomTypes: FastBookRoomType[];
  agents: BookableAgent[];
  staff?: BookableStaff[];
  defaultSoldByStaffId?: string;
  mealPlans?: {
    code: string;
    name: string;
    blurb: string | null;
    amountPerAdultNight?: number | null;
  }[];
  defaults?: {
    checkIn?: string;
    checkOut?: string;
    roomUnitId?: string;
    qtyByCode?: Record<string, number>;
    mealPlanCode?: string;
    guestOrigin?: string;
  };
  onCreated?: (bookingId: string, intent: DeskBookIntent) => void;
};

const initial: FastBookState = { ok: false };

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type GuestSourceUi = "local" | "agent" | "regional" | "international";

function sourceToBookedBy(ui: GuestSourceUi): string {
  if (ui === "agent") return "agent";
  return "reservation";
}

function sourceToOrigin(ui: GuestSourceUi): string {
  if (ui === "local") return "local";
  if (ui === "regional") return "regional";
  if (ui === "international") return "international";
  return "regional";
}

/**
 * Desk FO: one screen — dates, source/docs, rooms/meals, live rate (editable + PIN),
 * three create intents.
 */
export function DeskBookForm({
  roomTypes,
  agents,
  staff = [],
  defaultSoldByStaffId = "",
  mealPlans = [],
  defaults,
  onCreated,
}: DeskBookFormProps) {
  const [state, action, pending] = useActionState(createFastBooking, initial);
  useActionToast(state, { successMessage: "Reservation saved" });
  const minCheckIn = useMemo(() => todayIso(), []);
  const notified = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  const guestTypes = useMemo(
    () => roomTypes.filter((r) => r.inventory_kind === "sellable_guest"),
    [roomTypes],
  );

  const [sourceUi, setSourceUi] = useState<GuestSourceUi>(
    defaults?.guestOrigin === "local"
      ? "local"
      : defaults?.guestOrigin === "international"
        ? "international"
        : "regional",
  );
  const [agentId, setAgentId] = useState("");
  const [roomTypeId, setRoomTypeId] = useState(
    () =>
      guestTypes.find((g) => (defaults?.qtyByCode?.[g.code] ?? 0) > 0)?.id ??
      guestTypes[0]?.id ??
      "",
  );
  const [qty, setQty] = useState(() => {
    const match = guestTypes.find(
      (g) => (defaults?.qtyByCode?.[g.code] ?? 0) > 0,
    );
    return match ? defaults?.qtyByCode?.[match.code] ?? 1 : 1;
  });
  const [mealPlanCode, setMealPlanCode] = useState(
    defaults?.mealPlanCode ?? mealPlans[0]?.code ?? "EP",
  );
  const [paymentMode, setPaymentMode] = useState("cash");
  const [phoneLater, setPhoneLater] = useState(false);
  const [adults, setAdults] = useState(1);
  const [checkIn, setCheckIn] = useState(defaults?.checkIn ?? todayIso());
  const [checkOut, setCheckOut] = useState(
    defaults?.checkOut ??
      (() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return todayIsoFrom(d);
      })(),
  );

  const [systemNightly, setSystemNightly] = useState<number | null>(null);
  const [displayRate, setDisplayRate] = useState<string>("");
  const [rateDirty, setRateDirty] = useState(false);
  const [ratePin, setRatePin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [quoteHint, setQuoteHint] = useState<string | null>(null);
  const [quotePending, startQuote] = useTransition();
  const [intent, setIntent] = useState<DeskBookIntent>("confirm");
  const [agentPatches, setAgentPatches] = useState<
    Record<string, BookableAgent>
  >({});
  const [soldByStaffId, setSoldByStaffId] = useState(defaultSoldByStaffId);

  const selectedRoom = guestTypes.find((r) => r.id === roomTypeId) ?? null;
  const origin = sourceToOrigin(sourceUi);
  const bookedBy = sourceToBookedBy(sourceUi);
  const showAgent = sourceUi === "agent";
  const showGuide = sourceUi === "international";
  const showSdf = sdfRequired(origin as "local" | "regional" | "international" | "official");
  const idFieldLabel = idLabel(
    origin as "local" | "regional" | "international" | "official",
  );

  const pickerAgents = useMemo(() => {
    const extras = Object.values(agentPatches).filter(
      (p) => !agents.some((a) => a.id === p.id),
    );
    return [
      ...agents.map((a) => agentPatches[a.id] ?? a),
      ...extras,
    ];
  }, [agents, agentPatches]);

  const selectedAgent =
    pickerAgents.find((a) => a.id === agentId) ?? null;
  const blockCredit =
    needsCreditPromote(paymentMode, selectedAgent) && Boolean(agentId);

  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    const a = new Date(`${checkIn}T00:00:00`).getTime();
    const b = new Date(`${checkOut}T00:00:00`).getTime();
    if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
    return Math.round((b - a) / 86_400_000);
  }, [checkIn, checkOut]);

  const refreshQuote = useCallback(() => {
    if (!roomTypeId || !checkIn || !checkOut || nights < 1) return;
    startQuote(async () => {
      const r = await previewDeskStayQuote({
        checkIn,
        checkOut,
        roomTypeId,
        qty,
        adults,
        source: bookedBy,
        agentId: agentId || null,
      });
      if (!r.ok) {
        setQuoteHint(r.error);
        return;
      }
      setQuoteHint(
        r.systemNightlyBtn == null
          ? "No rate sheet for this season/tier — enter a rate + manager PIN."
          : `${r.seasonKind} · ${r.rateTier}`,
      );
      setSystemNightly(r.systemNightlyBtn);
      if (!rateDirty && r.systemNightlyBtn != null) {
        setDisplayRate(String(Math.round(r.systemNightlyBtn)));
        setShowPin(false);
        setRatePin("");
      }
    });
  }, [
    roomTypeId,
    checkIn,
    checkOut,
    nights,
    qty,
    adults,
    bookedBy,
    agentId,
    rateDirty,
  ]);

  useEffect(() => {
    refreshQuote();
  }, [refreshQuote]);

  // StayDatesField owns dates via hidden inputs — sync for live quote.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const sync = () => {
      const ci = (
        form.elements.namedItem("check_in") as HTMLInputElement | null
      )?.value;
      const co = (
        form.elements.namedItem("check_out") as HTMLInputElement | null
      )?.value;
      if (ci && ci !== checkIn) setCheckIn(ci);
      if (co && co !== checkOut) setCheckOut(co);
    };
    form.addEventListener("input", sync);
    form.addEventListener("change", sync);
    const t = window.setInterval(sync, 400);
    return () => {
      form.removeEventListener("input", sync);
      form.removeEventListener("change", sync);
      window.clearInterval(t);
    };
  }, [checkIn, checkOut]);

  useEffect(() => {
    if (sourceUi === "agent" && paymentMode === "cash") {
      setPaymentMode("on_credit");
    }
    if (sourceUi !== "agent" && paymentMode === "on_credit") {
      setPaymentMode("cash");
      setAgentId("");
    }
  }, [sourceUi, paymentMode]);

  useEffect(() => {
    if (!onCreated || !state.ok || !state.bookingId || notified.current) return;
    notified.current = true;
    onCreated(state.bookingId, state.intent ?? "confirm");
  }, [onCreated, state.ok, state.bookingId, state.intent]);

  const editedRate = Number(displayRate);
  const rateDiffers =
    systemNightly != null &&
    Number.isFinite(editedRate) &&
    Math.abs(editedRate - systemNightly) > 0.009;

  const handleRateChange = (v: string) => {
    setDisplayRate(v);
    setRateDirty(true);
    const n = Number(v);
    if (
      systemNightly != null &&
      Number.isFinite(n) &&
      Math.abs(n - systemNightly) > 0.009
    ) {
      setShowPin(true);
    } else if (systemNightly == null && v.trim() !== "") {
      setShowPin(true);
    } else {
      setShowPin(false);
      setRatePin("");
    }
  };

  const stayTotal =
    Number.isFinite(editedRate) && nights > 0
      ? editedRate * nights * qty
      : null;

  if (state.ok && state.bookingId && onCreated) {
    return (
      <div className="erp rounded-lg border bg-card px-4 py-8 text-center">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Saved
        </p>
        <p className="mt-2 text-sm text-muted-foreground">Opening stay…</p>
      </div>
    );
  }

  const sourceChips: { id: GuestSourceUi; label: string }[] = [
    { id: "local", label: "Local" },
    { id: "agent", label: "Agent" },
    { id: "regional", label: "Regional" },
    { id: "international", label: "International" },
  ];

  return (
    <form
      ref={formRef}
      action={action}
      className="erp flex min-h-0 flex-col"
      onSubmit={(e) => {
        if (rateDiffers && !ratePin.trim()) {
          e.preventDefault();
          setShowPin(true);
          return;
        }
        if (blockCredit) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="source" value={bookedBy} />
      <input type="hidden" name="guest_origin" value={origin} />
      <input type="hidden" name="meal_plan_code" value={mealPlanCode} />
      <input type="hidden" name="payment_mode" value={paymentMode} />
      <input type="hidden" name="agent_id" value={agentId} />
      <input type="hidden" name="sold_by_staff_id" value={soldByStaffId} />
      <input
        type="hidden"
        name="system_nightly_rate_btn"
        value={systemNightly != null ? String(systemNightly) : ""}
      />
      <input
        type="hidden"
        name="agreed_nightly_rate_btn"
        value={
          rateDiffers || (systemNightly == null && displayRate.trim())
            ? displayRate
            : ""
        }
      />
      <input type="hidden" name="manager_pin" value={ratePin} />
      {defaults?.roomUnitId ? (
        <input type="hidden" name="room_unit_id" value={defaults.roomUnitId} />
      ) : null}
      {/* qty for all room types */}
      {roomTypes.map((rt) => (
        <input
          key={rt.id}
          type="hidden"
          name={`qty_${rt.code}`}
          value={
            rt.id === roomTypeId && rt.inventory_kind === "sellable_guest"
              ? String(qty)
              : "0"
          }
        />
      ))}

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain pb-4">
        {state.error ? (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        {/* Dates */}
        <section className="space-y-3">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            Stay
          </p>
          <StayDatesField
            minCheckIn={minCheckIn}
            defaultMode="nights"
            defaultCheckIn={defaults?.checkIn}
            defaultCheckOut={defaults?.checkOut}
            showNightsAlways
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="db_adults">Adults</Label>
              <Input
                id="db_adults"
                name="adults"
                type="number"
                min={1}
                max={24}
                required
                value={adults}
                onChange={(e) => setAdults(Number(e.target.value) || 1)}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="db_children">Children</Label>
              <Input
                id="db_children"
                name="children"
                type="number"
                min={0}
                max={12}
                defaultValue={0}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="db_extra">Extra beds</Label>
              <Input
                id="db_extra"
                name="extra_beds"
                type="number"
                min={0}
                max={2}
                defaultValue={0}
                className="h-11"
              />
            </div>
          </div>
        </section>

        {/* Source */}
        <section className="space-y-3">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            Source
          </p>
          <div className="flex flex-wrap gap-2">
            {sourceChips.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSourceUi(c.id)}
                className={cn(
                  "min-h-11 rounded-md border px-3 text-sm font-medium transition-colors duration-150",
                  sourceUi === c.id
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-foreground hover:bg-muted/50",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contact_name">Guest name</Label>
            <Input
              id="contact_name"
              name="contact_name"
              required
              autoComplete="off"
              className="h-11"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="contact_phone">
                {sourceUi === "local" ? "Mobile" : "Phone"}
              </Label>
              <Input
                id="contact_phone"
                name="contact_phone"
                type="tel"
                required={!phoneLater}
                disabled={phoneLater}
                className="h-11"
              />
              <label className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  name="phone_later"
                  value="1"
                  checked={phoneLater}
                  onChange={(e) => setPhoneLater(e.target.checked)}
                  className="size-3.5 accent-foreground"
                />
                Phone later
              </label>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="passport_or_cid">{idFieldLabel}</Label>
              <Input
                id="passport_or_cid"
                name="passport_or_cid"
                className="h-11"
                placeholder={
                  origin === "local" ? "11-digit CID" : "Optional at book"
                }
              />
            </div>
          </div>
          {showSdf ? (
            <div className="space-y-1.5">
              <Label htmlFor="sdf_ref">SDF reference</Label>
              <Input
                id="sdf_ref"
                name="sdf_ref"
                className="h-11"
                placeholder="Optional at book · required at check-in"
              />
            </div>
          ) : null}
          {showGuide ? (
            <div className="space-y-1.5">
              <Label htmlFor="guide_number">Guide number</Label>
              <Input
                id="guide_number"
                name="guide_number"
                required
                className="h-11"
              />
            </div>
          ) : (
            <input type="hidden" name="guide_number" value="" />
          )}

          {showAgent ? (
            <div className="space-y-3 rounded-md border bg-muted/20 p-3">
              <AgentPicker
                agents={pickerAgents}
                value={agentId}
                onValueChange={(id) => {
                  setAgentId(id);
                  if (id) setPaymentMode("on_credit");
                }}
                creditMode={paymentMode === "on_credit"}
              />
              <div className="space-y-1.5">
                <Label>Payment</Label>
                <Select
                  value={paymentMode}
                  onValueChange={setPaymentMode}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="on_credit">On credit</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="prepaid">Prepaid</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {blockCredit && selectedAgent ? (
                <CreditAgentPromotePanel
                  agent={selectedAgent}
                  onPromoted={(a) =>
                    setAgentPatches((p) => ({ ...p, [a.id]: a }))
                  }
                  onUseCash={() => setPaymentMode("cash")}
                />
              ) : null}
            </div>
          ) : null}

          {staff.length > 0 ? (
            <div className="space-y-1.5">
              <Label>Sold by</Label>
              <StaffPicker
                staff={staff}
                value={soldByStaffId}
                onValueChange={setSoldByStaffId}
                name=""
              />
            </div>
          ) : null}
        </section>

        {/* Rooms + rate */}
        <section className="space-y-3">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            Room &amp; meal
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Room type</Label>
              <Select value={roomTypeId} onValueChange={setRoomTypeId}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {guestTypes.map((rt) => (
                    <SelectItem key={rt.id} value={rt.id}>
                      {rt.name} ({rt.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="db_qty">Rooms</Label>
              <Input
                id="db_qty"
                type="number"
                min={1}
                max={selectedRoom?.unit_count ?? 20}
                value={qty}
                onChange={(e) =>
                  setQty(Math.max(1, Number(e.target.value) || 1))
                }
                className="h-11"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Meal plan</Label>
              <Select value={mealPlanCode} onValueChange={setMealPlanCode}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(mealPlans.length
                    ? mealPlans
                    : [{ code: "EP", name: "Room only", blurb: null }]
                  ).map((p) => (
                    <SelectItem key={p.code} value={p.code}>
                      {p.code} · {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium">Nightly rate (Nu)</p>
              {quotePending ? (
                <span className="text-xs text-muted-foreground">Updating…</span>
              ) : quoteHint ? (
                <span className="text-xs text-muted-foreground">{quoteHint}</span>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <div className="min-w-[8rem] flex-1 space-y-1">
                <Input
                  type="number"
                  min={0}
                  step={5}
                  value={displayRate}
                  onChange={(e) => handleRateChange(e.target.value)}
                  className="h-12 text-lg font-semibold tabular-nums"
                  placeholder="—"
                  inputMode="numeric"
                />
                <p className="text-[11px] text-muted-foreground">
                  Click to edit. Manager PIN if different from system rate.
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                  Stay rooms
                </p>
                <p className="text-xl font-semibold tabular-nums">
                  {stayTotal != null ? formatGuestBtn(stayTotal) : "—"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {nights} night{nights === 1 ? "" : "s"} · {qty} room
                  {qty === 1 ? "" : "s"} · ends 0 or 5
                </p>
              </div>
            </div>
            {showPin ? (
              <div
                className="mt-3 space-y-1.5 border-t pt-3 duration-150 animate-in fade-in"
                role="group"
                aria-label="Manager PIN for rate change"
              >
                <Label htmlFor="desk_rate_pin">Manager PIN</Label>
                <Input
                  id="desk_rate_pin"
                  type="password"
                  autoComplete="off"
                  value={ratePin}
                  onChange={(e) => setRatePin(e.target.value)}
                  className="h-11 max-w-xs"
                  placeholder="Required for custom rate"
                />
              </div>
            ) : null}
          </div>
        </section>

        <details className="rounded-md border bg-muted/15">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
            More (notes, promo, email)
          </summary>
          <div className="space-y-3 border-t px-3 py-3">
            <div className="space-y-1.5">
              <Label htmlFor="contact_email">Email</Label>
              <Input id="contact_email" name="contact_email" type="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" name="notes" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo_code">Promo code</Label>
              <Input
                id="promo_code"
                name="promo_code"
                className="font-mono uppercase"
              />
            </div>
          </div>
        </details>
      </div>

      {/* Sticky footer CTAs */}
      <div className="sticky bottom-0 z-10 -mx-1 mt-2 space-y-2 border-t bg-background/95 px-1 pt-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button
            type="submit"
            variant="outline"
            disabled={pending || blockCredit || !roomTypeId}
            className="min-h-11"
            onClick={() => setIntent("reserve")}
          >
            {pending && intent === "reserve" ? "…" : "Reserve"}
          </Button>
          <Button
            type="submit"
            variant="secondary"
            disabled={pending || blockCredit || !roomTypeId}
            className="min-h-11"
            onClick={() => setIntent("confirm")}
          >
            {pending && intent === "confirm" ? "…" : "Reserve & confirm"}
          </Button>
          <Button
            type="submit"
            variant="citrus"
            disabled={pending || blockCredit || !roomTypeId}
            className="min-h-11"
            onClick={() => setIntent("check_in")}
          >
            {pending && intent === "check_in"
              ? "…"
              : "Reserve, confirm & check-in"}
          </Button>
        </div>
        <p className="text-center text-[11px] text-muted-foreground">
          Corrections: edit before check-in · undo CI if no F&B/pay · void
          lines after · manager after invoice
        </p>
      </div>
    </form>
  );
}

function todayIsoFrom(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
