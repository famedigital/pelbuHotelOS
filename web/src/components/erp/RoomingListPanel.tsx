"use client";

import {
  addPartyRoom,
  assignBookingRoomUnit,
  fetchRoomingList,
  removePartyRoom,
  upsertRoomingGuest,
  type RoomingLine,
  type RoomingListPayload,
} from "@/app/actions/erp-reservations-party";
import { useStayHubOptional } from "@/components/erp/StayHubProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recommendStayHubStep } from "@/lib/folio/stay-hub-cycle";
import { seedStayFromRoomingLine } from "@/lib/folio/stay-hub-seed";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

function LineRow({
  line,
  units,
  isParty,
  canRemove,
  onChanged,
}: {
  line: RoomingLine;
  units: RoomingListPayload["units"];
  isParty: boolean;
  canRemove: boolean;
  onChanged: () => void;
}) {
  const stayHub = useStayHubOptional();
  const [pending, startTransition] = useTransition();
  const primary = line.guests[0];
  const [name, setName] = useState(primary?.fullName ?? "");
  const [nationality, setNationality] = useState(primary?.nationality ?? "");
  const [doc, setDoc] = useState(primary?.passportOrCid ?? "");
  const [unitId, setUnitId] = useState(line.roomUnitId ?? "");
  const [showGuest, setShowGuest] = useState(
    Boolean(primary?.fullName?.trim() || primary?.passportOrCid?.trim()),
  );

  useEffect(() => {
    setName(primary?.fullName ?? "");
    setNationality(primary?.nationality ?? "");
    setDoc(primary?.passportOrCid ?? "");
    setUnitId(line.roomUnitId ?? "");
    setShowGuest(
      Boolean(primary?.fullName?.trim() || primary?.passportOrCid?.trim()),
    );
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

  function removeRoom() {
    if (!canRemove) return;
    if (
      !window.confirm(
        "Remove this room from the party? The reservation will be cancelled.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await removePartyRoom(line.bookingId);
      if (!res.ok) {
        toast.error(res.error ?? "Could not remove room");
        return;
      }
      toast.success(res.message ?? "Room removed");
      onChanged();
    });
  }

  const paxLabel =
    line.children > 0
      ? `${line.adults}A · ${line.children}C`
      : `${line.adults} adult${line.adults === 1 ? "" : "s"}`;

  return (
    <li className="rounded-lg border border-border/80 bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {line.roomTypeName ?? "Room"}
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
          <p className="text-[11px] text-muted-foreground">
            <span className="tabular-nums">{paxLabel}</span>
            {" · "}
            <span className="font-mono">{line.bookingId.slice(0, 8)}</span>
            {" · "}
            {line.status.replace(/_/g, " ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {canRemove ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-destructive"
              disabled={pending}
              onClick={removeRoom}
            >
              Remove
            </Button>
          ) : null}
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
                  seedStay: seedStayFromRoomingLine(line),
                })
              }
            >
              StayHub
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 space-y-2">
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

        {isParty && !showGuest ? (
          <button
            type="button"
            className="text-[11px] font-medium text-accent underline-offset-2 hover:underline"
            onClick={() => setShowGuest(true)}
          >
            Add guest name / ID (optional — SDF can wait)
          </button>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-[10px] text-muted-foreground">
                {isParty ? "Guest in this room (optional)" : "Guest (primary)"}
              </Label>
              <Input
                value={name}
                disabled={pending}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => {
                  if (
                    name.trim() &&
                    name.trim() !== (primary?.fullName ?? "").trim()
                  ) {
                    saveGuest();
                  }
                }}
                placeholder={isParty ? "Optional until check-in" : "Full name"}
                className="h-10"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">
                Nationality
              </Label>
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
        )}
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
  const [addUnitId, setAddUnitId] = useState("");
  const [pending, startTransition] = useTransition();

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
  const isParty = Boolean(payload.groupId) || multi;
  const uniqueBookingIds = new Set(payload.lines.map((l) => l.bookingId));
  const canRemovePartyRoom = Boolean(payload.groupId) && uniqueBookingIds.size > 1;

  const freeUnits = payload.units.filter((u) => u.available);

  function addRoom() {
    if (!addUnitId || !payload?.groupId) return;
    startTransition(async () => {
      const res = await addPartyRoom({
        anchorBookingId: bookingId,
        roomUnitId: addUnitId,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Could not add room");
        return;
      }
      toast.success(res.message ?? "Room added");
      setAddUnitId("");
      reload();
    });
  }

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

      {isParty ? (
        <div className="mt-2 rounded-md border border-border/70 bg-muted/20 px-3 py-2">
          <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            Leader / booker
          </p>
          <p className="text-sm font-medium text-foreground">
            {payload.leaderName?.trim() || "—"}
            {payload.leaderPhone ? (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {payload.leaderPhone}
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
            Party pax · {payload.totalAdults}A
            {payload.totalChildren > 0 ? ` · ${payload.totalChildren}C` : ""}
            {" · "}
            {payload.lines.length} room
            {payload.lines.length === 1 ? "" : "s"}
          </p>
        </div>
      ) : null}

      <p className="mt-1 text-xs text-muted-foreground">
        {isParty
          ? "Assign unit numbers and pax per room. Guest ID optional until SDF — leader is above."
          : "Assign unit numbers, then guest details per room."}
      </p>

      <ul className="mt-3 space-y-2">
        {payload.lines.map((line, idx) => (
          <LineRow
            key={`${line.bookingId}:${line.assignmentId ?? "open"}:${idx}`}
            line={line}
            units={payload.units}
            isParty={isParty}
            canRemove={
              canRemovePartyRoom &&
              !["checked_in", "checked_out"].includes(line.status)
            }
            onChanged={reload}
          />
        ))}
      </ul>

      {payload.groupId ? (
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border/60 pt-3">
          <div className="min-w-[12rem] flex-1 space-y-1">
            <Label className="text-[10px] text-muted-foreground">
              Add room to party
            </Label>
            <select
              className={selectClass}
              value={addUnitId}
              disabled={pending || freeUnits.length === 0}
              onChange={(e) => setAddUnitId(e.target.value)}
            >
              <option value="">
                {freeUnits.length === 0
                  ? "No free units in window"
                  : "Select free unit…"}
              </option>
              {freeUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                  {u.roomTypeName ? ` · ${u.roomTypeName}` : ""}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-10"
            disabled={pending || !addUnitId}
            onClick={addRoom}
          >
            {pending ? "Adding…" : "Add room"}
          </Button>
        </div>
      ) : multi ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Link as group first to add or remove rooms on this party.
        </p>
      ) : null}
    </section>
  );
}
