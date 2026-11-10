"use client";

import {
  chargeKitchenEventToFolio,
  createKitchenEvent,
  deleteKitchenEvent,
  updateKitchenEvent,
} from "@/app/actions/erp-kitchen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatBtn } from "@/lib/pricing";
import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";

export type KitchenEventRow = {
  id: string;
  eventDate: string;
  title: string;
  covers: number;
  mealPeriod: string;
  notes: string | null;
  serviceTime: string | null;
  serviceEnd: string | null;
  menuNote: string | null;
  venue: string | null;
  contactName: string | null;
  contactPhone: string | null;
  status: string;
  ratePerPaxBtn: number | null;
  packageTotalBtn: number | null;
  depositBtn: number;
  billingStatus: string;
  billNote: string | null;
  folioId: string | null;
  bookingId: string | null;
  postedFolioLineId: string | null;
  folioLabel: string | null;
};

export type FolioOption = {
  id: string;
  label: string;
  bookingId: string | null;
};

const initial = { ok: false } as const;

function timeInput(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 5);
}

function formatTimeRange(
  start: string | null,
  end: string | null,
): string | null {
  if (!start && !end) return null;
  const a = start ? start.slice(0, 5) : "—";
  if (!end) return a;
  return `${a}–${end.slice(0, 5)}`;
}

function resolvePackage(
  covers: number,
  rate: number | null,
  packageTotal: number | null,
): number | null {
  if (packageTotal != null && packageTotal > 0) return packageTotal;
  if (rate != null && rate > 0 && covers > 0) return rate * covers;
  return packageTotal;
}

function balanceDue(
  packageTotal: number | null,
  deposit: number,
  billingStatus: string,
): number | null {
  if (packageTotal == null) return null;
  if (billingStatus === "paid" || billingStatus === "comp") return 0;
  return Math.max(0, packageTotal - deposit);
}

function statusBadgeVariant(
  status: string,
): "outline" | "default" | "secondary" | "gold" {
  if (status === "confirmed" || status === "served") return "gold";
  if (status === "cancelled") return "secondary";
  return "outline";
}

function FieldGrid({
  children,
  className = "grid gap-3 sm:grid-cols-2",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}

function selectClassName() {
  return "h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm";
}

function EventFields({
  defaultDate,
  event,
  folios,
  prefix,
}: {
  defaultDate: string;
  event?: KitchenEventRow;
  folios: FolioOption[];
  prefix: string;
}) {
  return (
    <>
      <FieldGrid>
        <div className="space-y-1">
          <Label htmlFor={`${prefix}_date`}>Date</Label>
          <Input
            id={`${prefix}_date`}
            name="event_date"
            type="date"
            defaultValue={event?.eventDate ?? defaultDate}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${prefix}_period`}>Meal period</Label>
          <select
            id={`${prefix}_period`}
            name="meal_period"
            className={selectClassName()}
            defaultValue={event?.mealPeriod ?? "lunch"}
          >
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="all">All meals</option>
          </select>
        </div>
      </FieldGrid>

      <FieldGrid>
        <div className="space-y-1">
          <Label htmlFor={`${prefix}_time`}>Service start</Label>
          <Input
            id={`${prefix}_time`}
            name="service_time"
            type="time"
            defaultValue={timeInput(event?.serviceTime ?? null)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${prefix}_end`}>Service end</Label>
          <Input
            id={`${prefix}_end`}
            name="service_end"
            type="time"
            defaultValue={timeInput(event?.serviceEnd ?? null)}
          />
        </div>
      </FieldGrid>

      <FieldGrid>
        <div className="space-y-1">
          <Label htmlFor={`${prefix}_pax`}>Pax (covers)</Label>
          <Input
            id={`${prefix}_pax`}
            name="covers"
            type="number"
            min={0}
            defaultValue={event?.covers ?? 0}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${prefix}_status`}>Ops status</Label>
          <select
            id={`${prefix}_status`}
            name="status"
            className={selectClassName()}
            defaultValue={event?.status ?? "planned"}
          >
            <option value="planned">Planned</option>
            <option value="confirmed">Confirmed</option>
            <option value="served">Served</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </FieldGrid>

      <div className="space-y-1">
        <Label htmlFor={`${prefix}_title`}>Event title</Label>
        <Input
          id={`${prefix}_title`}
          name="title"
          required
          defaultValue={event?.title}
          placeholder="Agent group lunch · wedding reception"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor={`${prefix}_menu`}>Menu for kitchen</Label>
        <Textarea
          id={`${prefix}_menu`}
          name="menu_note"
          rows={3}
          defaultValue={event?.menuNote ?? ""}
          placeholder="Set menu: ema datshi, red rice, salad · veg option ×4 · no pork · cake 15:00"
        />
      </div>

      <FieldGrid>
        <div className="space-y-1">
          <Label htmlFor={`${prefix}_venue`}>Venue / room</Label>
          <Input
            id={`${prefix}_venue`}
            name="venue"
            defaultValue={event?.venue ?? ""}
            placeholder="Restaurant · terrace · meeting room"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${prefix}_contact`}>Organizer</Label>
          <Input
            id={`${prefix}_contact`}
            name="contact_name"
            defaultValue={event?.contactName ?? ""}
            placeholder="Name"
          />
        </div>
      </FieldGrid>

      <div className="space-y-1">
        <Label htmlFor={`${prefix}_phone`}>Organizer phone</Label>
        <Input
          id={`${prefix}_phone`}
          name="contact_phone"
          defaultValue={event?.contactPhone ?? ""}
          placeholder="+975 …"
        />
      </div>

      <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Bill
        </p>
        <FieldGrid>
          <div className="space-y-1">
            <Label htmlFor={`${prefix}_rate`}>Rate / pax (Nu)</Label>
            <Input
              id={`${prefix}_rate`}
              name="rate_per_pax_btn"
              type="number"
              min={0}
              step="0.01"
              defaultValue={event?.ratePerPaxBtn ?? ""}
              placeholder="0"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${prefix}_total`}>Package total (Nu)</Label>
            <Input
              id={`${prefix}_total`}
              name="package_total_btn"
              type="number"
              min={0}
              step="0.01"
              defaultValue={event?.packageTotalBtn ?? ""}
              placeholder="Auto = rate × pax"
            />
          </div>
        </FieldGrid>
        <FieldGrid>
          <div className="space-y-1">
            <Label htmlFor={`${prefix}_deposit`}>Deposit received (Nu)</Label>
            <Input
              id={`${prefix}_deposit`}
              name="deposit_btn"
              type="number"
              min={0}
              step="0.01"
              defaultValue={event?.depositBtn ?? 0}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${prefix}_bill_status`}>Billing status</Label>
            <select
              id={`${prefix}_bill_status`}
              name="billing_status"
              className={selectClassName()}
              defaultValue={event?.billingStatus ?? "none"}
            >
              <option value="none">Not set</option>
              <option value="quoted">Quoted</option>
              <option value="confirmed">Confirmed / deposit</option>
              <option value="posted">Posted to folio</option>
              <option value="paid">Paid</option>
              <option value="comp">Complimentary</option>
            </select>
          </div>
        </FieldGrid>
        <div className="space-y-1">
          <Label htmlFor={`${prefix}_folio`}>Link open folio</Label>
          <select
            id={`${prefix}_folio`}
            name="folio_id"
            className={selectClassName()}
            defaultValue={event?.folioId ?? ""}
          >
            <option value="">— no folio —</option>
            {folios.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        {event?.bookingId ? (
          <input type="hidden" name="booking_id" value={event.bookingId} />
        ) : null}
        <div className="space-y-1">
          <Label htmlFor={`${prefix}_bill_note`}>Bill notes</Label>
          <Textarea
            id={`${prefix}_bill_note`}
            name="bill_note"
            rows={2}
            defaultValue={event?.billNote ?? ""}
            placeholder="Agent on credit · pay at checkout · Pro-forma #…"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor={`${prefix}_notes`}>Logistics notes</Label>
        <Textarea
          id={`${prefix}_notes`}
          name="notes"
          rows={2}
          defaultValue={event?.notes ?? ""}
          placeholder="Setup time, AV, cake cut, special requests"
        />
      </div>
    </>
  );
}

function CreateEventForm({
  defaultDate,
  folios,
}: {
  defaultDate: string;
  folios: FolioOption[];
}) {
  const [state, action, pending] = useActionState(createKitchenEvent, initial);
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium"
        aria-expanded={open}
      >
        <span>Add banquet / group event</span>
        <span className="text-xs text-muted-foreground">
          {open ? "Collapse" : "Expand"}
        </span>
      </button>
      {open ? (
        <form action={action} className="space-y-3 border-t px-3 py-3">
          <EventFields
            defaultDate={defaultDate}
            folios={folios}
            prefix="ke_new"
          />
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Add event"}
          </Button>
          {state.message ? (
            <p className="text-xs text-emerald-600">{state.message}</p>
          ) : null}
          {state.error ? (
            <p className="text-xs text-destructive">{state.error}</p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

function EventCard({
  event,
  defaultDate,
  folios,
}: {
  event: KitchenEventRow;
  defaultDate: string;
  folios: FolioOption[];
}) {
  const [editing, setEditing] = useState(false);
  const [updateState, updateAction, updatePending] = useActionState(
    updateKitchenEvent,
    initial,
  );
  const [chargeState, chargeAction, chargePending] = useActionState(
    chargeKitchenEventToFolio,
    initial,
  );
  const [, deleteAction, deletePending] = useActionState(
    deleteKitchenEvent,
    initial,
  );

  const pkg = resolvePackage(
    event.covers,
    event.ratePerPaxBtn,
    event.packageTotalBtn,
  );
  const due = balanceDue(pkg, event.depositBtn, event.billingStatus);
  const timeRange = formatTimeRange(event.serviceTime, event.serviceEnd);
  const canCharge =
    Boolean(event.folioId) &&
    !event.postedFolioLineId &&
    event.billingStatus !== "comp" &&
    (pkg ?? 0) > 0;

  if (editing) {
    return (
      <li className="rounded-lg border bg-background p-3">
        <form action={updateAction} className="space-y-3">
          <input type="hidden" name="event_id" value={event.id} />
          <EventFields
            defaultDate={defaultDate}
            event={event}
            folios={folios}
            prefix={`ke_${event.id.slice(0, 8)}`}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={updatePending}>
              {updatePending ? "Saving…" : "Save changes"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
          {updateState.message ? (
            <p className="text-xs text-emerald-600">{updateState.message}</p>
          ) : null}
          {updateState.error ? (
            <p className="text-xs text-destructive">{updateState.error}</p>
          ) : null}
        </form>
      </li>
    );
  }

  return (
    <li className="rounded-lg border bg-background p-3 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">{event.title}</p>
            <Badge variant={statusBadgeVariant(event.status)} className="capitalize">
              {event.status}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {event.mealPeriod === "all" ? "All meals" : event.mealPeriod}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="tabular-nums">{event.eventDate}</span>
            {timeRange ? (
              <>
                {" "}
                · <span className="tabular-nums text-foreground">{timeRange}</span>
              </>
            ) : null}
            {" · "}
            <span className="font-medium text-foreground tabular-nums">
              {event.covers} pax
            </span>
            {event.venue ? <> · {event.venue}</> : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEditing(true)}
          >
            Edit
          </Button>
          <form action={deleteAction}>
            <input type="hidden" name="event_id" value={event.id} />
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="text-destructive"
              disabled={deletePending}
            >
              Remove
            </Button>
          </form>
        </div>
      </div>

      {event.menuNote ? (
        <div className="rounded-md border border-citrus/30 bg-citrus-tint/20 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Menu
          </p>
          <p className="mt-0.5 text-sm whitespace-pre-wrap text-foreground">
            {event.menuNote}
          </p>
        </div>
      ) : (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          No menu recorded — edit to add set menu for kitchen.
        </p>
      )}

      {(event.contactName || event.contactPhone) && (
        <p className="text-xs text-muted-foreground">
          Organizer:{" "}
          <span className="text-foreground">
            {event.contactName ?? "—"}
            {event.contactPhone ? ` · ${event.contactPhone}` : ""}
          </span>
        </p>
      )}

      {event.notes ? (
        <p className="text-xs text-muted-foreground">
          Logistics: {event.notes}
        </p>
      ) : null}

      <div className="rounded-md border px-2.5 py-2 space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Bill
          </p>
          <Badge variant="outline" className="capitalize text-[10px]">
            {event.billingStatus === "none" ? "No bill status" : event.billingStatus}
          </Badge>
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Rate / pax</dt>
            <dd className="font-medium tabular-nums">
              {event.ratePerPaxBtn != null
                ? formatBtn(event.ratePerPaxBtn)
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Package</dt>
            <dd className="font-medium tabular-nums">
              {pkg != null ? formatBtn(pkg) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Deposit</dt>
            <dd className="font-medium tabular-nums">
              {formatBtn(event.depositBtn)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Balance</dt>
            <dd className="font-medium tabular-nums">
              {due != null ? formatBtn(due) : "—"}
            </dd>
          </div>
        </dl>
        {event.billNote ? (
          <p className="text-xs text-muted-foreground">{event.billNote}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {event.folioId ? (
            <Link
              href={`/erp/folios/${event.folioId}`}
              className="text-xs font-medium text-accent underline-offset-4 hover:underline"
            >
              Folio: {event.folioLabel ?? event.folioId.slice(0, 8)} →
            </Link>
          ) : (
            <span className="text-xs text-muted-foreground">No folio linked</span>
          )}
          {event.postedFolioLineId ? (
            <span className="text-xs text-emerald-700 dark:text-emerald-400">
              Charged to folio
            </span>
          ) : null}
          {canCharge ? (
            <form action={chargeAction}>
              <input type="hidden" name="event_id" value={event.id} />
              <input type="hidden" name="folio_id" value={event.folioId ?? ""} />
              <Button type="submit" size="sm" disabled={chargePending}>
                {chargePending ? "Posting…" : "Post package to folio"}
              </Button>
            </form>
          ) : null}
        </div>
        {chargeState.message ? (
          <p className="text-xs text-emerald-600">{chargeState.message}</p>
        ) : null}
        {chargeState.error ? (
          <p className="text-xs text-destructive">{chargeState.error}</p>
        ) : null}
      </div>
    </li>
  );
}

export function KitchenEventsPanel({
  defaultDate,
  events,
  folios,
}: {
  defaultDate: string;
  events: KitchenEventRow[];
  folios: FolioOption[];
}) {
  const active = events.filter((e) => e.status !== "cancelled");
  const totalPax = active.reduce((s, e) => s + e.covers, 0);
  const totalPackage = active.reduce((s, e) => {
    const p = resolvePackage(e.covers, e.ratePerPaxBtn, e.packageTotalBtn);
    return s + (p ?? 0);
  }, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>
          <span className="font-medium tabular-nums text-foreground">
            {active.length}
          </span>{" "}
          upcoming
        </span>
        <span>
          <span className="font-medium tabular-nums text-foreground">
            {totalPax}
          </span>{" "}
          pax total
        </span>
        {totalPackage > 0 ? (
          <span>
            packages{" "}
            <span className="font-medium tabular-nums text-foreground">
              {formatBtn(totalPackage)}
            </span>
          </span>
        ) : null}
      </div>

      <CreateEventForm defaultDate={defaultDate} folios={folios} />

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No upcoming banquets or group meals. Add date, time, pax, menu, and
          bill so kitchen and FO share one picture.
        </p>
      ) : (
        <ul className="space-y-3">
          {events.map((ev) => (
            <EventCard
              key={ev.id}
              event={ev}
              defaultDate={defaultDate}
              folios={folios}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
