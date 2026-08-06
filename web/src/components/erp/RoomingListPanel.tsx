"use client";

import {
  assignBookingRoomUnit,
  fetchRoomingList,
  upsertRoomingGuest,
  type RoomingLine,
  type RoomingListPayload,
} from "@/app/actions/erp-reservations-party";
import { useStayHubOptional } from "@/components/erp/StayHubProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recommendStayHubStep } from "@/lib/folio/stay-hub-cycle";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

function LineRow({
  line,
  units,
  onChanged,
}: {
  line: RoomingLine;
  units: RoomingListPayload["units"];
  onChanged: () => void;
}) {
  const stayHub = useStayHubOptional();
  const [pending, startTransition] = useTransition();
  const primary = line.guests[0];
  const [name, setName] = useState(primary?.fullName ?? "");
  const [nationality, setNationality] = useState(primary?.nationality ?? "");
  const [doc, setDoc] = useState(primary?.passportOrCid ?? "");
  const [unitId, setUnitId] = useState(line.roomUnitId ?? "");

  useEffect(() => {
    setName(primary?.fullName ?? "");
    setNationality(primary?.nationality ?? "");
    setDoc(primary?.passportOrCid ?? "");
    setUnitId(line.roomUnitId ?? "");
  }, [
    primary?.fullName,
    primary?.nationality,
    primary?.passportOrCid,
    line.roomUnitId,
    line.assignmentId,
    line.bookingId,
  ]);

  const unitsForLine = units.filter(
    (u) =>
      u.available ||
      u.id === line.roomUnitId ||
      (line.roomTypeId ? u.roomTypeId === line.roomTypeId : true),
  );

  function saveGuest() {
    startTransition(async () => {
      const res = await upsertRoomingGuest({
        bookingId: line.bookingId,
        guestId: primary?.id,
        assignmentId: line.assignmentId,
        fullName: name,
        nationality: nationality || null,
        passportOrCid: doc || null,
        sortOrder: 0,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Could not save guest");
        return;
      }
      toast.success(res.message ?? "Guest saved");
      onChanged();
    });
  }

  function saveRoom(nextUnitId: string) {
    if (!nextUnitId) return;
    setUnitId(nextUnitId);
    startTransition(async () => {
      const res = await assignBookingRoomUnit({
        bookingId: line.bookingId,
        roomUnitId: nextUnitId,
        assignmentId: line.assignmentId,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Could not assign room");
        setUnitId(line.roomUnitId ?? "");
        return;
      }
      toast.success(res.message ?? "Room assigned");
      onChanged();
    });
  }

  return (
    <li className="rounded-lg border border-border/80 bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {line.roomTypeName ?? line.contactName ?? "Room"}
            {line.roomLabel ? (
              <span className="ml-2 font-mono tabular-nums text-accent">
                #{line.roomLabel}
              </span>
            ) : (
              <span className="ml-2 text-xs font-normal text-destructive">
                Unassigned
              </span>
            )}
          </p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {line.bookingId.slice(0, 8)} · {line.status.replace(/_/g, " ")}
          </p>
        </div>
        {stayHub ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            onClick={() =>
              stayHub.openStayHub({
                bookingId: line.bookingId,
                step: recommendStayHubStep({
                  status: line.status,
                  hasRoomAssigned: Boolean(line.roomUnitId),
                  board: "reservations",
                }),
                board: "reservations",
              })
            }
          >
            StayHub
          </Button>
        ) : null}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Room #</Label>
          <select
            className={selectClass}
            value={unitId}
            disabled={pending}
            onChange={(e) => saveRoom(e.target.value)}
          >
            <option value="">Select unit…</option>
            {unitsForLine.map((u) => (
              <option
                key={u.id}
                value={u.id}
                disabled={!u.available && u.id !== line.roomUnitId}
              >
                {u.label}
                {u.floorLabel ? ` · fl ${u.floorLabel}` : ""}
                {!u.available && u.id !== line.roomUnitId
                  ? ` (${u.reason ?? "busy"})`
                  : ""}
                {u.roomTypeName ? ` · ${u.roomTypeName}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">
            Guest (primary)
          </Label>
          <Input
            value={name}
            disabled={pending}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              if (name.trim() && name.trim() !== (primary?.fullName ?? "").trim()) {
                saveGuest();
              }
            }}
            placeholder="Full name"
            className="h-10"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Nationality</Label>
          <Input
            value={nationality}
            disabled={pending}
            onChange={(e) => setNationality(e.target.value)}
            onBlur={() => {
              if (
                nationality.trim() !== (primary?.nationality ?? "").trim() &&
                name.trim()
              ) {
                saveGuest();
              }
            }}
            placeholder="Optional"
            className="h-10"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">
            Passport / CID
          </Label>
          <Input
            value={doc}
            disabled={pending}
            onChange={(e) => setDoc(e.target.value)}
            onBlur={() => {
              if (
                doc.trim() !== (primary?.passportOrCid ?? "").trim() &&
                name.trim()
              ) {
                saveGuest();
              }
            }}
            placeholder="Optional"
            className="h-10"
          />
        </div>
      </div>
    </li>
  );
}

export function RoomingListPanel({
  bookingId,
  compact = false,
}: {
  bookingId: string;
  compact?: boolean;
}) {
  const [payload, setPayload] = useState<RoomingListPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchRoomingList(bookingId).then((res) => {
      if (res.ok) {
        setPayload(res.data);
      } else {
        setError(res.error);
        setPayload(null);
      }
      setLoading(false);
    });
  }, [bookingId]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (loading) {
    return (
      <p className="py-2 text-sm text-muted-foreground">Loading rooming list…</p>
    );
  }
  if (error || !payload) {
    return (
      <p className="py-2 text-sm text-destructive">
        {error ?? "Could not load rooming list"}
      </p>
    );
  }

  const multi =
    payload.partyBookingIds.length > 1 || payload.lines.length > 1;

  return (
    <section
      className={`rounded-lg border bg-card ${compact ? "p-3" : "p-3 sm:p-4"}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          Rooming list
        </h3>
        <p className="text-xs text-muted-foreground">
          {payload.groupName
            ? `Party · ${payload.groupName}`
            : multi
              ? `${payload.lines.length} room(s)`
              : "1 room"}
          {payload.groupId ? " · formal group" : ""}
        </p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Assign unit numbers, then guest details per room — standard group PMS
        flow.
      </p>
      <ul className={`mt-3 space-y-2 ${compact ? "" : ""}`}>
        {payload.lines.map((line, idx) => (
          <LineRow
            key={`${line.bookingId}:${line.assignmentId ?? "open"}:${idx}`}
            line={line}
            units={payload.units}
            onChanged={reload}
          />
        ))}
      </ul>
    </section>
  );
}
