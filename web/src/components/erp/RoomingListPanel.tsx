"use client";

import {
  addPartyRoom,
  assignBookingRoomUnit,
  extendPartyRoom,
  fetchRoomingList,
  removePartyRoom,
  updatePartyRoomLine,
  upsertRoomingGuest,
  type RoomingLine,
  type RoomingListPayload,
} from "@/app/actions/erp-reservations-party";
import { resizeCalendarAssignment } from "@/app/actions/erp-calendar";
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
  const [adults, setAdults] = useState(String(line.adults ?? 1));
  const [children, setChildren] = useState(String(line.children ?? 0));
  const [mealPlan, setMealPlan] = useState("EP");
  const [checkIn, setCheckIn] = useState(line.checkIn.slice(0, 10));
  const [checkOut, setCheckOut] = useState(line.checkOut.slice(0, 10));
  const [showGuest, setShowGuest] = useState(
    Boolean(primary?.fullName?.trim() || primary?.passportOrCid?.trim()),
  );

  useEffect(() => {
    setName(primary?.fullName ?? "");
    setNationality(primary?.nationality ?? "");
    setDoc(primary?.passportOrCid ?? "");
    setUnitId(line.roomUnitId ?? "");
    setAdults(String(line.adults ?? 1));
    setChildren(String(line.children ?? 0));
    setCheckIn(line.checkIn.slice(0, 10));
    setCheckOut(line.checkOut.slice(0, 10));
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
    line.adults,
    line.children,
    line.checkIn,
    line.checkOut,
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

  function savePax() {
    if (["checked_in", "checked_out"].includes(line.status)) {
      toast.error("Cannot edit pax after check-in");
      return;
    }
    startTransition(async () => {
      const res = await updatePartyRoomLine({
        bookingId: line.bookingId,
        adults: Number(adults) || 1,
        children: Number(children) || 0,
        mealPlanCode: mealPlan || null,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Could not update");
        return;
      }
      toast.success(res.message ?? "Updated");
      onChanged();
    });
  }

  function applyDates() {
    if (!line.assignmentId) {
      toast.error("Assign a room unit before changing dates");
      return;
    }
    startTransition(async () => {
      const res = await resizeCalendarAssignment(
        line.assignmentId!,
        checkIn,
        checkOut,
      );
      if (!res.ok) {
        toast.error(res.error ?? "Could not update dates");
        return;
      }
      toast.success("Dates updated");
      onChanged();
    });
  }

  function extendOne() {
    startTransition(async () => {
      const res = await extendPartyRoom(line.bookingId, 1);
      if (!res.ok) {
        toast.error(res.error ?? "Could not extend");
        return;
      }
      toast.success(res.message ?? "Extended +1n");
      onChanged();
    });
  }

  const removeBlockedReason = !isParty
    ? "Link as group first"
    : ["checked_in", "checked_out"].includes(line.status)
      ? "In-house / checked out â€” cannot remove"
      : !canRemove
        ? "Cannot remove the last room on a party"
        : null;

  const inputXs = "h-8 min-w-[3.5rem] text-xs tabular-nums";

  return (
    <tr className="border-t border-border/60 align-top">
      <td className="px-1.5 py-1.5">
        <select
          className="h-8 w-full min-w-[5.5rem] rounded-md border border-input bg-background px-1.5 text-xs outline-none"
          value={unitId}
          disabled={pending}
          onChange={(e) => saveRoom(e.target.value)}
        >
          <option value="">Unitâ€¦</option>
          {unitsForLine.map((u) => (
            <option
              key={u.id}
              value={u.id}
              disabled={!u.available && u.id !== line.roomUnitId}
            >
              {u.label}
              {!u.available && u.id !== line.roomUnitId ? " Â· busy" : ""}
            </option>
          ))}
        </select>
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
          {line.roomTypeName ?? "Room"}
        </p>
      </td>
      <td className="px-1.5 py-1.5 text-[10px] capitalize text-muted-foreground">
        {line.status.replace(/_/g, " ")}
      </td>
      <td className="px-1.5 py-1.5">
        <div className="flex gap-1">
          <Input
            type="number"
            min={1}
            max={12}
            className={inputXs}
            value={adults}
            disabled={pending || ["checked_in", "checked_out"].includes(line.status)}
            onChange={(e) => setAdults(e.target.value)}
            onBlur={savePax}
            aria-label="Adults"
          />
          <Input
            type="number"
            min={0}
            max={12}
            className={inputXs}
            value={children}
            disabled={pending || ["checked_in", "checked_out"].includes(line.status)}
            onChange={(e) => setChildren(e.target.value)}
            onBlur={savePax}
            aria-label="Children"
          />
        </div>
      </td>
      <td className="px-1.5 py-1.5">
        <select
          className="h-8 w-full rounded-md border border-input bg-background px-1.5 text-xs"
          value={mealPlan}
          disabled={pending || ["checked_in", "checked_out"].includes(line.status)}
          onChange={(e) => {
            setMealPlan(e.target.value);
            startTransition(async () => {
              const res = await updatePartyRoomLine({
                bookingId: line.bookingId,
                mealPlanCode: e.target.value,
              });
              if (!res.ok) toast.error(res.error ?? "Could not update");
              else onChanged();
            });
          }}
        >
          <option value="EP">EP</option>
          <option value="BB">BB</option>
          <option value="MAP">MAP</option>
          <option value="AP">AP</option>
        </select>
      </td>
      <td className="px-1.5 py-1.5">
        {showGuest ? (
          <div className="space-y-1">
            <Input
              className="h-8 text-xs"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveGuest}
              placeholder="Guest"
            />
          </div>
        ) : (
          <button
            type="button"
            className="text-[10px] text-muted-foreground hover:text-foreground"
            onClick={() => setShowGuest(true)}
          >
            + Guest
          </button>
        )}
      </td>
      <td className="px-1.5 py-1.5">
        <div className="flex flex-col gap-1">
          <Input
            type="date"
            className={inputXs}
            value={checkIn}
            disabled={pending}
            onChange={(e) => setCheckIn(e.target.value)}
          />
          <Input
            type="date"
            className={inputXs}
            value={checkOut}
            disabled={pending}
            onChange={(e) => setCheckOut(e.target.value)}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 px-1.5 text-[10px]"
            disabled={pending}
            onClick={applyDates}
          >
            Apply
          </Button>
        </div>
      </td>
      <td className="px-1.5 py-1.5">
        <div className="flex flex-col gap-0.5">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 justify-start px-1 text-[10px]"
            disabled={pending}
            onClick={extendOne}
          >
            +1n
          </Button>
          {canRemove ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 justify-start px-1 text-[10px] text-destructive"
              disabled={pending}
              onClick={removeRoom}
            >
              Remove
            </Button>
          ) : removeBlockedReason ? (
            <span
              className="max-w-[5rem] text-[9px] leading-tight text-muted-foreground"
              title={removeBlockedReason}
            >
              â€”
            </span>
          ) : null}
          {stayHub ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 justify-start px-1 text-[10px]"
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
              Open
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
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
  const [addAdults, setAddAdults] = useState("2");
  const [addChildren, setAddChildren] = useState("0");
  const [addMeal, setAddMeal] = useState("EP");
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
      <p className="py-2 text-sm text-muted-foreground">Loading rooming listâ€¦</p>
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
        adults: Number(addAdults) || 1,
        children: Number(addChildren) || 0,
        mealPlanCode: addMeal,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Could not add room");
        return;
      }
      toast.success(res.message ?? "Room added");
      setAddUnitId("");
      setAddAdults("2");
      setAddChildren("0");
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
            ? `Party Â· ${payload.groupName}`
            : multi
              ? `${payload.lines.length} room(s)`
              : "1 room"}
          {payload.groupId ? " Â· formal group" : ""}
        </p>
      </div>

      {isParty ? (
        <div className="mt-2 rounded-md border border-border/70 bg-muted/20 px-3 py-2">
          <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            Leader / booker
          </p>
          <p className="text-sm font-medium text-foreground">
            {payload.leaderName?.trim() || "â€”"}
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
          ? "Assign units, pax, meal, dates per row. Guest optional until SDF."
          : "Assign unit numbers, then guest details per room."}
      </p>

      <div className="mt-2 max-h-[min(55vh,32rem)] overflow-auto rounded-md border border-border/70">
        <table className="w-full min-w-[44rem] border-collapse text-left text-xs">
          <thead className="sticky top-0 z-[1] bg-muted/95 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase backdrop-blur">
            <tr>
              <th className="px-1.5 py-1.5">Room</th>
              <th className="px-1.5 py-1.5">Status</th>
              <th className="px-1.5 py-1.5">A · C</th>
              <th className="px-1.5 py-1.5">Meal</th>
              <th className="px-1.5 py-1.5">Guest</th>
              <th className="px-1.5 py-1.5">Dates</th>
              <th className="px-1.5 py-1.5">Actions</th>
            </tr>
          </thead>
          <tbody>
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
          </tbody>
        </table>
      </div>

      {payload.groupId ? (
        <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
          <div className="flex flex-wrap items-end gap-2">
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
            <div className="w-16 space-y-1">
              <Label className="text-[10px] text-muted-foreground">Adults</Label>
              <Input
                type="number"
                min={1}
                className="h-10"
                value={addAdults}
                onChange={(e) => setAddAdults(e.target.value)}
              />
            </div>
            <div className="w-16 space-y-1">
              <Label className="text-[10px] text-muted-foreground">Child</Label>
              <Input
                type="number"
                min={0}
                className="h-10"
                value={addChildren}
                onChange={(e) => setAddChildren(e.target.value)}
              />
            </div>
            <div className="min-w-[7rem] space-y-1">
              <Label className="text-[10px] text-muted-foreground">Meal</Label>
              <select
                className={selectClass}
                value={addMeal}
                onChange={(e) => setAddMeal(e.target.value)}
              >
                <option value="EP">EP</option>
                <option value="BB">BB</option>
                <option value="MAP">MAP</option>
                <option value="AP">AP</option>
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
              {pending ? "Addingâ€¦" : "Add room"}
            </Button>
          </div>
        </div>
      ) : multi ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Link as group first to add or remove rooms on this party.
        </p>
      ) : null}
    </section>
  );
}
