"use client";

import {
  createFastBooking,
  type FastBookState,
} from "@/app/actions/fast-book";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useActionToast } from "@/hooks/use-action-toast";
import { FastBookDrawer } from "./FastBookDrawer";
import { FastBookGrid } from "./FastBookGrid";
import { FastBookInvoice, type FastBookInvoiceData } from "./FastBookInvoice";
import { FastBookVoucher, type FastBookVoucherData } from "./FastBookVoucher";
import { StayDatesField } from "@/components/ui/StayDatesField";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TriangleAlertIcon } from "lucide-react";
import type { PropertyDocumentDesign } from "@/lib/property-settings";
import { cn } from "@/lib/utils";

export type FastBookRoomType = {
  id: string;
  code: string;
  name: string;
  inventory_kind: string;
  unit_count: number;
};

import type { BookableAgent } from "@/components/erp/AgentPicker";
import type { BookableStaff } from "@/components/erp/StaffPicker";

export type FastBookAgent = BookableAgent;

const initial: FastBookState = { ok: false };

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(`${checkIn}T00:00:00`).getTime();
  const b = new Date(`${checkOut}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
  return Math.round((b - a) / 86_400_000);
}

type Snapshot = {
  checkIn: string;
  checkOut: string;
  adults: number;
  contactName: string;
  contactPhone: string;
  agentId?: string;
  agentLabel?: string;
  guideNumber?: string;
  sourceLabel?: string;
  paymentLabel?: string;
  lines: { name: string; code: string; qty: number; kind: string }[];
};

export type FastBookFormProps = {
  roomTypes: FastBookRoomType[];
  agents: FastBookAgent[];
  staff?: BookableStaff[];
  defaultSoldByStaffId?: string;
  property?: {
    name: string;
    legal_name?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    tax_id?: string | null;
    logo_public_id?: string | null;
  };
  invoiceDesign?: PropertyDocumentDesign;
  voucherDesign?: PropertyDocumentDesign;
  mealPlans?: {
    code: string;
    name: string;
    blurb: string | null;
    amountPerAdultNight: number | null;
  }[];
  defaults?: {
    checkIn?: string;
    checkOut?: string;
    roomUnitId?: string;
    roomUnitLabel?: string;
    qtyByCode?: Record<string, number>;
    mealPlanCode?: string;
    guestOrigin?: string;
  };
  /**
   * Modal path: fire once after create, then close Fast Book and open StayHub.
   * When set, SuccessSplit invoices are skipped.
   */
  onCreated?: (bookingId: string) => void;
  /** Compact layout inside Dialog / mobile sheet. */
  embedded?: boolean;
};

export function FastBookForm({
  roomTypes,
  agents,
  staff = [],
  defaultSoldByStaffId = "",
  property,
  invoiceDesign,
  voucherDesign,
  mealPlans = [],
  defaults,
  onCreated,
  embedded = false,
}: FastBookFormProps) {
  const [state, action, pending] = useActionState(createFastBooking, initial);
  useActionToast(state, {
    successMessage: onCreated ? "Reservation created" : "Booking saved",
  });
  const minCheckIn = useMemo(() => todayIso(), []);
  const notifiedCreated = useRef(false);

  const [qtyValues, setQtyValues] = useState<Record<string, number>>(
    () => defaults?.qtyByCode ?? {},
  );
  const [drawerOpen, setDrawerOpen] = useState(
    () => Object.values(defaults?.qtyByCode ?? {}).some((v) => v > 0),
  );
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  const hasQty = Object.values(qtyValues).some((v) => v > 0);
  const selectedGuestCategories = useMemo(
    () =>
      roomTypes
        .filter(
          (roomType) =>
            roomType.inventory_kind === "sellable_guest" &&
            (qtyValues[roomType.code] ?? 0) > 0,
        )
        .map((roomType) => ({
          ...roomType,
          qty: qtyValues[roomType.code] ?? 0,
        })),
    [qtyValues, roomTypes],
  );
  const hasMixedGuestCategories = selectedGuestCategories.length > 1;

  const handleQtyChange = (code: string, value: number) => {
    setQtyValues((prev) => {
      const next = { ...prev, [code]: value };
      const any = Object.values(next).some((v) => v > 0);
      if (any && !drawerOpen) setDrawerOpen(true);
      return next;
    });
  };

  useEffect(() => {
    if (!onCreated || !state.ok || !state.bookingId || notifiedCreated.current)
      return;
    notifiedCreated.current = true;
    onCreated(state.bookingId);
  }, [onCreated, state.ok, state.bookingId]);

  if (state.ok && state.bookingId) {
    if (onCreated) {
      return (
        <div className="erp rounded-lg border bg-card px-4 py-8 text-center">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Saved
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Opening StayHub at Reserve…
          </p>
        </div>
      );
    }
    return (
      <SuccessSplit
        bookingId={state.bookingId}
        snapshot={snapshot}
        roomTypes={roomTypes}
        property={property}
        invoiceDesign={invoiceDesign}
        voucherDesign={voucherDesign}
      />
    );
  }

  return (
    <form
      action={action}
      onSubmit={(e) => {
        // Capture what the user is submitting so the success view can render it.
        const formEl = e.currentTarget;
        // Allow the native submit to proceed; capture synchronously before clear.
        try {
          const fd = new FormData(formEl);
          setSnapshot(buildSnapshot(fd, roomTypes, agents));
        } catch {
          // ignore — form still submits via React action
        }
      }}
      className={cn(
        "erp grid min-w-0 grid-cols-1 gap-5 md:gap-6",
        embedded
          ? "md:grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]"
          : "md:grid-cols-[minmax(0,1fr)_360px]",
      )}
    >
      {defaults?.roomUnitId ? (
        <input type="hidden" name="room_unit_id" value={defaults.roomUnitId} />
      ) : null}
      {state.error ? (
        <Alert variant="destructive" className="md:col-span-2">
          <TriangleAlertIcon />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="min-w-0 space-y-5 md:space-y-6">
        <div className="space-y-4 rounded-lg border bg-card p-4 md:p-5">
          <StayDatesField
            minCheckIn={minCheckIn}
            defaultMode="nights"
            defaultCheckIn={defaults?.checkIn}
            defaultCheckOut={defaults?.checkOut}
            showNightsAlways
          />
          <div className="max-w-[200px] space-y-1.5">
            <Label htmlFor="adults">Adults</Label>
            <Input
              id="adults"
              type="number"
              name="adults"
              required
              min={1}
              max={24}
              defaultValue={1}
              inputMode="numeric"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="children">Children (6–12)</Label>
              <Input
                id="children"
                type="number"
                name="children"
                min={0}
                max={12}
                defaultValue={0}
                inputMode="numeric"
              />
              <p className="text-[11px] leading-snug text-muted-foreground">
                Half meal package · 0–6 free (omit)
              </p>
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="extra_beds">Extra beds</Label>
              <Input
                id="extra_beds"
                type="number"
                name="extra_beds"
                min={0}
                max={2}
                defaultValue={0}
                inputMode="numeric"
              />
              <p className="text-[11px] leading-snug text-muted-foreground">
                Max 2 · rate from Rates &amp; meals settings
              </p>
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-4 rounded-lg border bg-card p-4 md:p-5">
          {selectedGuestCategories.length > 0 ? (
            <div
              className={`rounded-md border p-3 ${
                hasMixedGuestCategories
                  ? "border-amber-300 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/20"
                  : "bg-muted/30"
              }`}
            >
              <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                Selected room categories
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {selectedGuestCategories.map((category) => (
                  <Badge
                    key={category.id}
                    variant={hasMixedGuestCategories ? "maroon" : "secondary"}
                  >
                    {category.qty}× {category.name} ({category.code})
                  </Badge>
                ))}
              </div>
              {hasMixedGuestCategories ? (
                <label className="mt-3 flex items-start gap-2 text-sm text-amber-900 dark:text-amber-200">
                  <input
                    type="checkbox"
                    required
                    className="mt-0.5 size-4 accent-amber-600"
                  />
                  <span>
                    I reviewed this mixed-category booking. Rates may differ by
                    category.
                  </span>
                </label>
              ) : null}
            </div>
          ) : null}
          <FastBookGrid
            roomTypes={roomTypes}
            qtyValues={qtyValues}
            onQtyChange={handleQtyChange}
          />
        </div>
      </div>

      <FastBookDrawer
        agents={agents}
        staff={staff}
        defaultSoldByStaffId={defaultSoldByStaffId}
        pending={pending}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        hasQty={hasQty}
        mealPlans={mealPlans}
        defaultMealPlanCode={defaults?.mealPlanCode ?? "EP"}
        defaultGuestOrigin={defaults?.guestOrigin ?? "regional"}
      />
    </form>
  );
}

/**
 * Builds the snapshot of what the user submitted, so the post-save success
 * split can render the saved booking details (which the server action does not
 * return — its contract is `{ ok, bookingId, error }`).
 */
function buildSnapshot(
  fd: FormData,
  roomTypes: FastBookRoomType[],
  agents: FastBookAgent[],
): Snapshot {
  const get = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" ? v : "";
  };

  const sourceLabel = SOURCE_LABELS[get("source")] ?? get("source");
  const paymentLabel = PAYMENT_LABELS[get("payment_mode")] ?? get("payment_mode");

  const agentId = get("agent_id");
  const agent = agents.find((a) => a.id === agentId);
  const agentLabel = agent
    ? `${agent.company_name} (${agent.market}${
        agent.status === "demo"
          ? ", demo"
          : agent.status === "directory"
            ? ", directory"
            : ""
      })`
    : undefined;

  const lines = roomTypes
    .map((rt) => ({
      name: rt.name,
      code: rt.code,
      qty: Number(get(`qty_${rt.code}`) || 0),
      kind: rt.inventory_kind,
    }))
    .filter((l) => l.qty > 0);

  return {
    checkIn: get("check_in"),
    checkOut: get("check_out"),
    adults: Number(get("adults") || 0),
    contactName: get("contact_name"),
    contactPhone: get("contact_phone"),
    agentId: agent?.id,
    agentLabel,
    guideNumber: get("guide_number") || undefined,
    sourceLabel,
    paymentLabel,
    lines,
  };
}

function SuccessSplit({
  bookingId,
  snapshot,
  roomTypes,
  property,
  invoiceDesign,
  voucherDesign,
}: {
  bookingId: string;
  snapshot: Snapshot | null;
  roomTypes: FastBookRoomType[];
  property?: FastBookFormProps["property"];
  invoiceDesign?: PropertyDocumentDesign;
  voucherDesign?: PropertyDocumentDesign;
}) {
  // Fallback if snapshot is missing (e.g. JS-disabled submit): minimal invoice only.
  const checkIn = snapshot?.checkIn ?? "";
  const checkOut = snapshot?.checkOut ?? "";
  const nights = nightsBetween(checkIn, checkOut);
  const adults = snapshot?.adults ?? 0;

  const invoiceData: FastBookInvoiceData = {
    bookingId,
    checkIn,
    checkOut,
    nights,
    adults,
    guestName: snapshot?.contactName ?? "",
    agentLabel: snapshot?.agentLabel,
    sourceLabel: snapshot?.sourceLabel,
    paymentLabel: snapshot?.paymentLabel,
    lines: snapshot?.lines ?? [],
  };

  const voucherData: FastBookVoucherData = {
    bookingId,
    checkIn,
    checkOut,
    nights,
    guestName: snapshot?.contactName ?? "",
    guestPhone: snapshot?.contactPhone,
    agentId: snapshot?.agentId,
    agentLabel: snapshot?.agentLabel,
    guideNumber: snapshot?.guideNumber,
    lines:
      snapshot?.lines.map((l) => ({ name: l.name, code: l.code, qty: l.qty })) ??
      roomTypes.map((r) => ({ name: r.name, code: r.code, qty: 0 })),
  };

  return (
    <div className="erp space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3 print:hidden">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Saved
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Booking confirmed
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="citrus" className="h-11">
            <a href="/erp/fast-book">Book another</a>
          </Button>
          <Button asChild variant="outline" className="h-11">
            <a href="/erp">Back to inbox</a>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 print:block">
        <FastBookInvoice data={invoiceData} property={property} design={invoiceDesign} />
        <FastBookVoucher data={voucherData} property={property} design={voucherDesign} />
      </div>
    </div>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  owner: "Owner",
  reservation: "Reservation",
  agent: "Agent",
  mou_agent: "MoU agent",
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Cash",
  prepaid: "Prepaid",
  partial: "Partial",
  on_credit: "On credit",
};
