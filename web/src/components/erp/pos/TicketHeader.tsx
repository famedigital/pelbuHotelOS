"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DiningTable, PosStaffOption } from "@/lib/pos";
import { ChevronDownIcon } from "lucide-react";
import { useMemo, useState } from "react";
import type { PosBookingOption } from "./types";

const NONE = "__none__";

function roleLabel(value: string): string {
  return value.replace(/_/g, " ");
}

type Props = {
  customerName: string;
  onCustomerNameChange: (v: string) => void;
  phone: string;
  onPhoneChange: (v: string) => void;
  settleMode: "cash" | "room_charge";
  onSettleModeChange: (v: "cash" | "room_charge") => void;
  bookingId: string;
  roomUnitId: string;
  onRoomUnitIdChange: (v: string) => void;
  bookingGuestId: string;
  onBookingGuestIdChange: (v: string) => void;
  bookings: PosBookingOption[];
  notes: string;
  onNotesChange: (v: string) => void;
  tables: DiningTable[];
  tableId: string;
  onTableIdChange: (v: string) => void;
  covers: string;
  onCoversChange: (v: string) => void;
  courseCount: string;
  onCourseCountChange: (v: string) => void;
  staff: PosStaffOption[];
  serverStaffId: string;
  onServerStaffIdChange: (v: string) => void;
};

export function TicketHeader({
  customerName,
  onCustomerNameChange,
  phone,
  onPhoneChange,
  settleMode,
  onSettleModeChange,
  bookingId,
  roomUnitId,
  onRoomUnitIdChange,
  bookingGuestId,
  onBookingGuestIdChange,
  bookings,
  notes,
  onNotesChange,
  tables,
  tableId,
  onTableIdChange,
  covers,
  onCoversChange,
  courseCount,
  onCourseCountChange,
  staff,
  serverStaffId,
  onServerStaffIdChange,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const outletTables = tables;
  const selectedTable = outletTables.find((t) => t.id === tableId) ?? null;
  const roomOptions = bookings.flatMap((booking) =>
    booking.rooms.map((room) => ({ booking, room })),
  );
  const selectedBooking =
    bookings.find((booking) => booking.id === bookingId) ?? null;

  const tableGroups = useMemo(() => {
    const map = new Map<string | null, DiningTable[]>();
    for (const table of outletTables) {
      const key = table.outlet;
      const list = map.get(key) ?? [];
      list.push(table);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) => {
      if (a[0] === null) return -1;
      if (b[0] === null) return 1;
      return a[0].localeCompare(b[0]);
    });
  }, [outletTables]);

  return (
    <div className="erp rounded-xl border bg-card">
      <div className="grid gap-3 px-4 py-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="space-y-1.5">
          <Label htmlFor="th_customer_name" className="text-xs text-muted-foreground">
            Guest name
          </Label>
          <Input
            id="th_customer_name"
            type="text"
            required
            autoComplete="off"
            placeholder="Walk-in name"
            value={customerName}
            onChange={(e) => onCustomerNameChange(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="th_phone" className="text-xs text-muted-foreground">
            Phone
          </Label>
          <Input
            id="th_phone"
            type="tel"
            required
            inputMode="tel"
            autoComplete="off"
            placeholder="Mobile"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">How to bill</Label>
          <Tabs
            value={settleMode}
            onValueChange={(v) =>
              onSettleModeChange(v as "cash" | "room_charge")
            }
          >
            <TabsList className="h-9 w-full">
              <TabsTrigger value="cash">Pay now</TabsTrigger>
              <TabsTrigger value="room_charge">Charge to room</TabsTrigger>
            </TabsList>
          </Tabs>
          <p className="text-[10px] text-muted-foreground">
            {settleMode === "room_charge"
              ? "Adds to guest folio now; guest pays at checkout. Tax invoice issues from folio, not this ticket."
              : "Creates an open ticket — settle cash/card later when the guest pays."}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="th_room_unit_id"
            className={
              settleMode === "room_charge"
                ? "text-xs font-medium text-foreground"
                : "text-xs text-muted-foreground"
            }
          >
            In-house room
            {settleMode === "room_charge" ? " (required)" : ""}
          </Label>
          <Select
            value={roomUnitId || NONE}
            onValueChange={(value) =>
              onRoomUnitIdChange(value === NONE ? "" : value)
            }
          >
            <SelectTrigger
              id="th_room_unit_id"
              className={`w-full ${
                settleMode === "room_charge" && !roomUnitId
                  ? "border-citrus ring-1 ring-citrus/30"
                  : ""
              }`}
            >
              <SelectValue placeholder="Walk-in / select room" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Walk-in / no room</SelectItem>
              {roomOptions.map(({ booking, room }) => (
                <SelectItem key={`${booking.id}-${room.id}`} value={room.id}>
                  {room.label} · {booking.contact_name ?? "Guest"}
                  {booking.agent_name ? ` · ${booking.agent_name}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {settleMode === "room_charge" && !roomUnitId ? (
            <p className="text-[10px] text-citrus">
              Select the in-house room to post this ticket to the guest folio.
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="th_guest_id" className="text-xs text-muted-foreground">
            Guest
          </Label>
          <Select
            value={bookingGuestId || NONE}
            onValueChange={(value) =>
              onBookingGuestIdChange(value === NONE ? "" : value)
            }
            disabled={!selectedBooking}
          >
            <SelectTrigger id="th_guest_id" className="w-full">
              <SelectValue placeholder="Select room first" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>
                {selectedBooking?.contact_name ?? "Primary guest"}
              </SelectItem>
              {selectedBooking?.guests
                .filter((guest) => guest.id)
                .map((guest) => (
                  <SelectItem key={guest.id} value={guest.id as string}>
                    {guest.full_name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {selectedBooking?.source === "agent" ? (
            <p className="text-[10px] text-muted-foreground">
              Stay by agent; POS stays guest-paid unless Charge to room is
              selected.
            </p>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between gap-2 border-t px-4 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/50"
        aria-expanded={expanded}
      >
        <span>
          {selectedTable
            ? `${selectedTable.name}${covers ? ` · ${covers} covers` : ""}`
            : "Counter / takeaway"}
          {" · "}
          {expanded ? "hide" : "table, covers, server & notes"}
        </span>
        <ChevronDownIcon
          className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded ? (
        <div className="grid gap-3 border-t px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="th_table_id" className="text-xs text-muted-foreground">
              Table
            </Label>
            <Select
              value={tableId || NONE}
              onValueChange={(v) => onTableIdChange(v === NONE ? "" : v)}
            >
              <SelectTrigger id="th_table_id" className="w-full">
                <SelectValue placeholder="Counter / takeaway" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Counter / takeaway</SelectItem>
                {tableGroups.map(([groupOutlet, list]) => (
                  <SelectGroup key={groupOutlet ?? "shared"}>
                    <SelectLabel>
                      {groupOutlet
                        ? `${groupOutlet[0]!.toUpperCase()}${groupOutlet.slice(1)}`
                        : "Shared"}
                    </SelectLabel>
                    {list.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} · {t.seats} seats
                        {t.status !== "free" ? ` · ${t.status}` : ""}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            {outletTables.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">
                No tables yet — add them on the Floor plan tab.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="th_covers" className="text-xs text-muted-foreground">
              Covers
            </Label>
            <Input
              id="th_covers"
              type="number"
              min={1}
              max={40}
              inputMode="numeric"
              placeholder={selectedTable ? String(selectedTable.seats) : "1"}
              value={covers}
              onChange={(e) => onCoversChange(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="th_course_count"
              className="text-xs text-muted-foreground"
            >
              Courses
            </Label>
            <Input
              id="th_course_count"
              type="number"
              min={1}
              max={12}
              inputMode="numeric"
              value={courseCount}
              onChange={(e) => onCourseCountChange(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="th_server_staff_id"
              className="text-xs text-muted-foreground"
            >
              Server
            </Label>
            <Select
              value={serverStaffId || NONE}
              onValueChange={(v) => onServerStaffIdChange(v === NONE ? "" : v)}
            >
              <SelectTrigger id="th_server_staff_id" className="w-full">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Unassigned</SelectItem>
                {staff.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.full_name} · {roleLabel(s.role_label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {staff.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">
                Add staff in HR to assign a server.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
            <Label htmlFor="th_notes" className="text-xs text-muted-foreground">
              Ticket notes
            </Label>
            <Input
              id="th_notes"
              type="text"
              placeholder="Allergy, timing, or table request"
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
