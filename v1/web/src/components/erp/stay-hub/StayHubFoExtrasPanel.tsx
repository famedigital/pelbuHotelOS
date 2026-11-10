"use client";

import {
  updateStayHubFoExtras,
  type StayHubSummary,
} from "@/app/actions/stay-hub";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // Asia/Thimphu wall display (+06)
  const local = new Date(d.getTime() + 6 * 3_600_000);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, "0");
  const day = String(local.getUTCDate()).padStart(2, "0");
  const h = String(local.getUTCHours()).padStart(2, "0");
  const min = String(local.getUTCMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

/**
 * eZee ET Other / logistics lite — transport, visa chips, house use, DNR.
 */
export function StayHubFoExtrasForm({
  summary,
  onSuccess,
}: {
  summary: StayHubSummary;
  onSuccess: () => void;
}) {
  const [pending, start] = useTransition();
  const [houseUse, setHouseUse] = useState(summary.houseUse);
  const [dnr, setDnr] = useState(summary.dnr);
  const [dnrReason, setDnrReason] = useState(summary.dnrReason ?? "");
  const [pickupNeeded, setPickupNeeded] = useState(summary.pickupNeeded);
  const [dropoffNeeded, setDropoffNeeded] = useState(summary.dropoffNeeded);
  const [pickupAt, setPickupAt] = useState(toLocalInput(summary.pickupAt));
  const [dropoffAt, setDropoffAt] = useState(toLocalInput(summary.dropoffAt));
  const [arrivalMode, setArrivalMode] = useState(
    summary.transportArrivalMode ?? "",
  );
  const [departMode, setDepartMode] = useState(
    summary.transportDepartureMode ?? "",
  );
  const [transportNotes, setTransportNotes] = useState(
    summary.transportNotes ?? "",
  );
  const [visaNo, setVisaNo] = useState(summary.visaNo ?? "");
  const [visaExpiry, setVisaExpiry] = useState(summary.visaExpiry ?? "");
  const [arrivedFrom, setArrivedFrom] = useState(summary.arrivedFrom ?? "");
  const [purpose, setPurpose] = useState(summary.purposeOfVisit ?? "");

  useEffect(() => {
    setHouseUse(summary.houseUse);
    setDnr(summary.dnr);
    setDnrReason(summary.dnrReason ?? "");
    setPickupNeeded(summary.pickupNeeded);
    setDropoffNeeded(summary.dropoffNeeded);
    setPickupAt(toLocalInput(summary.pickupAt));
    setDropoffAt(toLocalInput(summary.dropoffAt));
    setArrivalMode(summary.transportArrivalMode ?? "");
    setDepartMode(summary.transportDepartureMode ?? "");
    setTransportNotes(summary.transportNotes ?? "");
    setVisaNo(summary.visaNo ?? "");
    setVisaExpiry(summary.visaExpiry ?? "");
    setArrivedFrom(summary.arrivedFrom ?? "");
    setPurpose(summary.purposeOfVisit ?? "");
  }, [summary]);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await updateStayHubFoExtras({
            bookingId: summary.bookingId,
            houseUse,
            dnr,
            dnrReason: dnr ? dnrReason : null,
            pickupNeeded,
            dropoffNeeded,
            pickupAt: pickupNeeded ? pickupAt || null : null,
            dropoffAt: dropoffNeeded ? dropoffAt || null : null,
            transportArrivalMode: arrivalMode || null,
            transportDepartureMode: departMode || null,
            transportNotes: transportNotes || null,
            visaNo: visaNo || null,
            visaExpiry: visaExpiry || null,
            arrivedFrom: arrivedFrom || null,
            purposeOfVisit: purpose || null,
          });
          if (!r.ok) {
            toast.error(r.error);
            return;
          }
          toast.success("FO details saved");
          onSuccess();
        });
      }}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="flex items-center gap-1.5 text-[11px]">
          <input
            type="checkbox"
            checked={houseUse}
            onChange={(e) => setHouseUse(e.target.checked)}
            className="size-3.5 accent-foreground"
          />
          House use
        </label>
        <label className="flex items-center gap-1.5 text-[11px]">
          <input
            type="checkbox"
            checked={dnr}
            onChange={(e) => setDnr(e.target.checked)}
            className="size-3.5 accent-foreground"
          />
          DNR
        </label>
        <label className="flex items-center gap-1.5 text-[11px]">
          <input
            type="checkbox"
            checked={pickupNeeded}
            onChange={(e) => setPickupNeeded(e.target.checked)}
            className="size-3.5 accent-foreground"
          />
          Pick-up
        </label>
        <label className="flex items-center gap-1.5 text-[11px]">
          <input
            type="checkbox"
            checked={dropoffNeeded}
            onChange={(e) => setDropoffNeeded(e.target.checked)}
            className="size-3.5 accent-foreground"
          />
          Drop-off
        </label>
      </div>

      {dnr ? (
        <div className="space-y-0.5">
          <Label className="text-[10px] font-normal text-muted-foreground">
            DNR reason
          </Label>
          <Input
            value={dnrReason}
            onChange={(e) => setDnrReason(e.target.value)}
            className="h-8 text-xs"
            placeholder="Optional reason"
          />
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-0.5">
          <Label className="text-[10px] font-normal text-muted-foreground">
            Arrival mode
          </Label>
          <Input
            value={arrivalMode}
            onChange={(e) => setArrivalMode(e.target.value)}
            className="h-8 text-xs"
            placeholder="Flight / bus / private"
          />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[10px] font-normal text-muted-foreground">
            Departure mode
          </Label>
          <Input
            value={departMode}
            onChange={(e) => setDepartMode(e.target.value)}
            className="h-8 text-xs"
            placeholder="Flight / bus / private"
          />
        </div>
        {pickupNeeded ? (
          <div className="space-y-0.5">
            <Label className="text-[10px] font-normal text-muted-foreground">
              Pick-up at
            </Label>
            <Input
              type="datetime-local"
              value={pickupAt}
              onChange={(e) => setPickupAt(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        ) : null}
        {dropoffNeeded ? (
          <div className="space-y-0.5">
            <Label className="text-[10px] font-normal text-muted-foreground">
              Drop-off at
            </Label>
            <Input
              type="datetime-local"
              value={dropoffAt}
              onChange={(e) => setDropoffAt(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        ) : null}
        <div className="space-y-0.5 sm:col-span-2">
          <Label className="text-[10px] font-normal text-muted-foreground">
            Transport notes
          </Label>
          <Input
            value={transportNotes}
            onChange={(e) => setTransportNotes(e.target.value)}
            className="h-8 text-xs"
            placeholder="Flight no., station, vehicle…"
          />
        </div>
      </div>

      <div className="grid gap-2 border-t border-border/50 pt-2 sm:grid-cols-2">
        <div className="space-y-0.5">
          <Label className="text-[10px] font-normal text-muted-foreground">
            Visa no.
          </Label>
          <Input
            value={visaNo}
            onChange={(e) => setVisaNo(e.target.value)}
            className="h-8 font-mono text-xs"
          />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[10px] font-normal text-muted-foreground">
            Visa expiry
          </Label>
          <Input
            type="date"
            value={visaExpiry}
            onChange={(e) => setVisaExpiry(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[10px] font-normal text-muted-foreground">
            Arrived from
          </Label>
          <Input
            value={arrivedFrom}
            onChange={(e) => setArrivedFrom(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[10px] font-normal text-muted-foreground">
            Purpose of visit
          </Label>
          <Input
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="h-8 text-xs"
            placeholder="Tourism / business / transit"
          />
        </div>
      </div>

      {(summary.releaseDaysBeforeArrival != null ||
        summary.depositDueOn) && (
        <p className="text-[10px] text-muted-foreground">
          Release
          {summary.releaseDaysBeforeArrival != null
            ? ` ${summary.releaseDaysBeforeArrival}d`
            : ""}
          {summary.releasePercent != null
            ? ` / ${summary.releasePercent}%`
            : ""}
          {summary.depositDueOn
            ? ` · deposit due ${summary.depositDueOn}`
            : ""}
        </p>
      )}

      <Button type="submit" size="sm" className="h-8" disabled={pending}>
        {pending ? "Saving…" : "Save FO extras"}
      </Button>
    </form>
  );
}

export function StayHubAuditStrip({ summary }: { summary: StayHubSummary }) {
  const fmt = (iso: string | null) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Thimphu",
      });
    } catch {
      return iso.slice(0, 16);
    }
  };

  return (
    <div className="space-y-1.5 rounded-md border border-border/60 bg-muted/20 px-2.5 py-2 text-[11px]">
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
        <span>
          Booked <span className="text-foreground">{fmt(summary.bookedAt)}</span>
          {summary.soldByName ? (
            <span className="text-foreground"> · {summary.soldByName}</span>
          ) : null}
        </span>
        <span>
          CI <span className="text-foreground">{fmt(summary.checkedInAt)}</span>
        </span>
        <span>
          CO <span className="text-foreground">{fmt(summary.checkedOutAt)}</span>
        </span>
      </div>
      {summary.auditTrail.length > 0 ? (
        <ul className="max-h-24 space-y-0.5 overflow-y-auto border-t border-border/40 pt-1">
          {summary.auditTrail.map((a, i) => (
            <li key={`${a.at}-${i}`} className="text-muted-foreground">
              <span className="tabular-nums text-foreground/80">
                {fmt(a.at)}
              </span>
              {" · "}
              {a.summary || a.action}
              {a.actor ? ` · ${a.actor}` : ""}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">No audit events yet.</p>
      )}
    </div>
  );
}

export function StayHubNextResBanner({
  summary,
  onOpen,
}: {
  summary: StayHubSummary;
  onOpen?: (bookingId: string) => void;
}) {
  const next = summary.nextRes;
  if (!next) return null;
  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-950 dark:text-amber-100">
      <p className="font-medium">Next reservation on this room</p>
      <p className="mt-0.5">
        {next.contactName || "Guest"} · {next.checkIn}
        {next.confirmationCode ? ` · ${next.confirmationCode}` : ""} ·{" "}
        {next.status}
        {onOpen ? (
          <>
            {" · "}
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => onOpen(next.bookingId)}
            >
              Open
            </button>
          </>
        ) : null}
      </p>
    </div>
  );
}
