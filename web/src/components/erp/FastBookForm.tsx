"use client";

import {
  createFastBooking,
  type FastBookState,
} from "@/app/actions/fast-book";
import { useActionState, useMemo, useState } from "react";
import { FastBookDrawer } from "./FastBookDrawer";
import { FastBookGrid } from "./FastBookGrid";
import { FastBookInvoice, type FastBookInvoiceData } from "./FastBookInvoice";
import { FastBookVoucher, type FastBookVoucherData } from "./FastBookVoucher";
import { StayDatesField } from "@/components/ui/StayDatesField";

export type FastBookRoomType = {
  id: string;
  code: string;
  name: string;
  inventory_kind: string;
  unit_count: number;
};

export type FastBookAgent = {
  id: string;
  company_name: string;
  market: string;
  status: string;
};

const initial: FastBookState = { ok: false };

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fieldClassName() {
  return "mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2.5 text-sm text-espresso outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/20";
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
  agentLabel?: string;
  guideNumber?: string;
  sourceLabel?: string;
  paymentLabel?: string;
  lines: { name: string; code: string; qty: number; kind: string }[];
};

type Props = {
  roomTypes: FastBookRoomType[];
  agents: FastBookAgent[];
};

export function FastBookForm({ roomTypes, agents }: Props) {
  const [state, action, pending] = useActionState(createFastBooking, initial);
  const minCheckIn = useMemo(() => todayIso(), []);

  const [qtyValues, setQtyValues] = useState<Record<string, number>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  const hasQty = Object.values(qtyValues).some((v) => v > 0);

  const handleQtyChange = (code: string, value: number) => {
    setQtyValues((prev) => {
      const next = { ...prev, [code]: value };
      const any = Object.values(next).some((v) => v > 0);
      if (any && !drawerOpen) setDrawerOpen(true);
      return next;
    });
  };

  if (state.ok && state.bookingId) {
    return (
      <SuccessSplit
        bookingId={state.bookingId}
        snapshot={snapshot}
        roomTypes={roomTypes}
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
      className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_360px]"
    >
      {state.error ? (
        <p
          className="border border-maroon/30 bg-maroon/5 px-4 py-3 text-sm text-maroon md:col-span-2"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      <div className="space-y-6">
        <div className="space-y-4 border border-espresso/10 bg-white px-5 py-5">
          <StayDatesField minCheckIn={minCheckIn} defaultMode="nights" />
          <label className="block max-w-[180px] text-sm text-espresso">
            Adults
            <input
              type="number"
              name="adults"
              required
              min={1}
              max={24}
              defaultValue={2}
              inputMode="numeric"
              className={fieldClassName()}
            />
          </label>
        </div>

        <div className="border border-espresso/10 bg-white px-5 py-5">
          <FastBookGrid
            roomTypes={roomTypes}
            qtyValues={qtyValues}
            onQtyChange={handleQtyChange}
          />
        </div>
      </div>

      <FastBookDrawer
        agents={agents}
        pending={pending}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        hasQty={hasQty}
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
    ? `${agent.company_name} (${agent.market}${agent.status === "demo" ? ", demo" : ""})`
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
}: {
  bookingId: string;
  snapshot: Snapshot | null;
  roomTypes: FastBookRoomType[];
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
    agentLabel: snapshot?.agentLabel,
    guideNumber: snapshot?.guideNumber,
    lines:
      snapshot?.lines.map((l) => ({ name: l.name, code: l.code, qty: l.qty })) ??
      roomTypes.map((r) => ({ name: r.name, code: r.code, qty: 0 })),
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3 print:hidden">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.28em] text-gold uppercase">
            Saved
          </p>
          <h2 className="mt-1 text-3xl text-espresso">Booking confirmed</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href="/erp/fast-book"
            className="inline-flex min-h-11 items-center rounded-sm bg-gold px-5 text-sm font-medium text-espresso transition-opacity hover:opacity-90"
          >
            Book another
          </a>
          <a
            href="/erp"
            className="inline-flex min-h-11 items-center rounded-sm border border-espresso/20 px-5 text-sm text-espresso transition-colors hover:border-espresso/40 hover:bg-espresso/[0.03]"
          >
            Back to inbox
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 print:block">
        <FastBookInvoice data={invoiceData} />
        <FastBookVoucher data={voucherData} />
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
