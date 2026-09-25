"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import type { DiningTable, PosStaffOption } from "@/lib/pos";
import { ChevronDownIcon, MoreHorizontalIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { PosSaleKind } from "./PosSaleStartGate";
import type { PosBookingOption } from "./types";

const NONE = "__none__";

function roleLabel(value: string): string {
  return value.replace(/_/g, " ");
}

const fieldLabel = "text-[10px] font-medium text-muted-foreground";
const compactTrigger = "h-8 w-full min-w-0";

type Props = {
  saleKind: PosSaleKind;
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
  onReleaseTable?: () => void;
  hasOpenTicketOnTable?: boolean;
  /** Clear ticket context and return to Table / Room / Counter. */
  onChangeSaleKind?: () => void;
  /** Soft switch path without wiping the cart. */
  onSwitchSaleKind?: (kind: PosSaleKind) => void;
};

/**
 * Compact context bar while selling — primary fields inline; extras in a menu.
 */
export function TicketHeader({
  saleKind,
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
  onReleaseTable,
  hasOpenTicketOnTable = false,
  onChangeSaleKind,
  onSwitchSaleKind,
}: Props) {
  const needsRoom = saleKind === "room" || settleMode === "room_charge";
  const [expanded, setExpanded] = useState(needsRoom && !roomUnitId);

  const selectedTable = tables.find((t) => t.id === tableId) ?? null;
  const roomOptions = bookings.flatMap((booking) =>
    booking.rooms.map((room) => ({ booking, room })),
  );
  const selectedBooking =
    bookings.find((booking) => booking.id === bookingId) ?? null;
  const selectedRoom = roomOptions.find((r) => r.room.id === roomUnitId);

  const tableGroups = useMemo(() => {
    const map = new Map<string | null, DiningTable[]>();
    for (const table of tables) {
      const key = table.outlet;
      const list = map.get(key) ?? [];
      list.push(table);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) => {
      if (a[0] === null) return -1;
      if (b[0] === null) return 1;
      return (a[0] ?? "").localeCompare(b[0] ?? "");
    });
  }, [tables]);

  useEffect(() => {
    if (needsRoom && !roomUnitId) setExpanded(true);
  }, [needsRoom, roomUnitId]);

  const kindLabel =
    saleKind === "table"
      ? "Table"
      : saleKind === "room"
        ? "Room"
        : "Counter";

  const billLabel =
    settleMode === "room_charge" ? "Bill → room" : "Pay now";

  const primaryLine = (() => {
    if (saleKind === "table" && selectedTable) {
      return [
        selectedTable.name,
        covers ? `${covers} covers` : null,
        billLabel,
      ]
        .filter(Boolean)
        .join(" · ");
    }
    if (saleKind === "room" || settleMode === "room_charge") {
      if (selectedRoom) {
        return [
          selectedRoom.room.label,
          customerName || selectedRoom.booking.contact_name || "Guest",
          "Room charge",
        ]
          .filter(Boolean)
          .join(" · ");
      }
      return "Pick in-house room";
    }
    return [customerName.trim() || "Walk-in", billLabel].join(" · ");
  })();

  const moreActive = Boolean(
    phone || notes || (courseCount && courseCount !== "1") || serverStaffId,
  );

  const showPanel = (needsRoom && !roomUnitId) || expanded;

  return (
    <div className="erp rounded-lg border bg-card">
      <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-1.5">
        {onSwitchSaleKind ? (
          <div
            className="flex shrink-0 overflow-hidden rounded-md border bg-muted/40 p-0.5"
            role="group"
            aria-label="Sale path"
          >
            {(
              [
                ["table", "Table"],
                ["room", "Room"],
                ["counter", "Counter"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  if (id !== saleKind) onSwitchSaleKind(id);
                }}
                className={`h-6 rounded-[4px] px-2 text-[10px] font-semibold tracking-wide uppercase transition-colors ${
                  saleKind === id
                    ? "bg-accent text-accent-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <span className="inline-flex h-6 shrink-0 items-center rounded-md border bg-muted/60 px-2 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            {kindLabel}
          </span>
        )}
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {primaryLine}
        </p>

        {saleKind === "table" && selectedTable && onReleaseTable ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 gap-1 px-2 text-muted-foreground hover:text-destructive"
            onClick={onReleaseTable}
            title={
              hasOpenTicketOnTable
                ? "Void open ticket to free table"
                : "Release table"
            }
          >
            <XIcon className="size-3.5" />
            {hasOpenTicketOnTable ? "Void" : "Release"}
          </Button>
        ) : null}

        {onChangeSaleKind ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 shrink-0 px-2"
            onClick={onChangeSaleKind}
            title="New ticket — clears cart and returns to start"
          >
            New
          </Button>
        ) : null}

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-expanded={expanded}
        >
          {expanded ? "Less" : "Details"}
          <ChevronDownIcon
            className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {showPanel ? (
        <div className="flex flex-wrap items-end gap-2 border-t px-2.5 py-2">
          {(needsRoom || expanded) && (
            <div className="w-[min(100%,14rem)] space-y-0.5">
              <Label
                htmlFor="th_room_unit_id"
                className={
                  needsRoom
                    ? "text-[10px] font-medium text-foreground"
                    : fieldLabel
                }
              >
                Room{needsRoom ? " *" : ""}
              </Label>
              <Select
                value={roomUnitId || NONE}
                onValueChange={(value) =>
                  onRoomUnitIdChange(value === NONE ? "" : value)
                }
              >
                <SelectTrigger
                  id="th_room_unit_id"
                  className={`${compactTrigger} ${
                    needsRoom && !roomUnitId
                      ? "border-citrus ring-1 ring-citrus/30"
                      : ""
                  }`}
                >
                  <SelectValue placeholder="In-house room" />
                </SelectTrigger>
                <SelectContent>
                  {!needsRoom ? (
                    <SelectItem value={NONE}>No room link</SelectItem>
                  ) : null}
                  {roomOptions.map(({ booking, room }) => (
                    <SelectItem
                      key={`${booking.id}-${room.id}`}
                      value={room.id}
                    >
                      {room.label} · {booking.contact_name ?? "Guest"}
                      {booking.agent_name ? ` · ${booking.agent_name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {roomUnitId ? (
            <div className="w-[min(100%,11rem)] space-y-0.5">
              <Label htmlFor="th_guest_id" className={fieldLabel}>
                Guest
              </Label>
              <Select
                value={bookingGuestId || NONE}
                onValueChange={(value) =>
                  onBookingGuestIdChange(value === NONE ? "" : value)
                }
                disabled={!selectedBooking}
              >
                <SelectTrigger id="th_guest_id" className={compactTrigger}>
                  <SelectValue placeholder="Primary guest" />
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
            </div>
          ) : null}

          {(saleKind === "counter" || expanded) && (
            <div className="w-[min(100%,10rem)] space-y-0.5">
              <Label htmlFor="th_customer_name" className={fieldLabel}>
                Party
              </Label>
              <Input
                id="th_customer_name"
                type="text"
                autoComplete="off"
                className="h-8"
                placeholder="Walk-in / type party name"
                value={customerName}
                onChange={(e) => onCustomerNameChange(e.target.value)}
                onBlur={() => {
                  if (!customerName.trim()) onCustomerNameChange("Walk-in");
                }}
              />
            </div>
          )}

          {/* Always show party when table/room — not only counter */}
          {saleKind !== "counter" && !expanded ? (
            <div className="w-[min(100%,12rem)] space-y-0.5">
              <Label htmlFor="th_party_name" className={fieldLabel}>
                Party
              </Label>
              <Input
                id="th_party_name"
                type="text"
                autoComplete="off"
                className="h-8"
                placeholder="Type party name"
                value={customerName}
                onChange={(e) => onCustomerNameChange(e.target.value)}
                onBlur={() => {
                  if (!customerName.trim()) onCustomerNameChange("Walk-in");
                }}
              />
            </div>
          ) : null}

          {expanded && saleKind !== "room" ? (
            <div className="space-y-0.5">
              <span className={fieldLabel}>Bill</span>
              <div className="flex h-8 overflow-hidden rounded-md border">
                <button
                  type="button"
                  onClick={() => onSettleModeChange("cash")}
                  className={`px-2.5 text-[11px] font-medium ${
                    settleMode === "cash"
                      ? "bg-accent text-accent-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  Pay now
                </button>
                <button
                  type="button"
                  onClick={() => onSettleModeChange("room_charge")}
                  className={`border-l px-2.5 text-[11px] font-medium ${
                    settleMode === "room_charge"
                      ? "bg-accent text-accent-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  Room
                </button>
              </div>
            </div>
          ) : null}

          {expanded && saleKind !== "table" ? (
            <div className="w-[min(100%,9rem)] space-y-0.5">
              <Label htmlFor="th_table_id" className={fieldLabel}>
                Table
              </Label>
              <Select
                value={tableId || NONE}
                onValueChange={(v) => onTableIdChange(v === NONE ? "" : v)}
              >
                <SelectTrigger id="th_table_id" className={compactTrigger}>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {tableGroups.map(([groupOutlet, list]) => (
                    <SelectGroup key={groupOutlet ?? "shared"}>
                      <SelectLabel>
                        {groupOutlet
                          ? `${groupOutlet[0]!.toUpperCase()}${groupOutlet.slice(1)}`
                          : "Shared"}
                      </SelectLabel>
                      {list.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} · {t.seats}
                          {t.status !== "free" ? ` · ${t.status}` : ""}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {expanded ? (
            <div className="w-16 space-y-0.5">
              <Label htmlFor="th_covers" className={fieldLabel}>
                Covers
              </Label>
              <Input
                id="th_covers"
                type="number"
                min={1}
                max={40}
                inputMode="numeric"
                className="h-8"
                placeholder={
                  selectedTable ? String(selectedTable.seats) : "1"
                }
                value={covers}
                onChange={(e) => onCoversChange(e.target.value)}
              />
            </div>
          ) : null}

          {expanded ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 px-2"
                  aria-label="More ticket details"
                >
                  <MoreHorizontalIcon className="size-3.5" />
                  More
                  {moreActive ? (
                    <span className="size-1.5 rounded-full bg-accent" />
                  ) : null}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="erp w-72 space-y-2 p-3"
                onCloseAutoFocus={(e) => e.preventDefault()}
              >
                <DropdownMenuLabel className="px-0 pb-1">
                  Extra details
                </DropdownMenuLabel>
                <div className="space-y-0.5">
                  <Label htmlFor="th_phone" className={fieldLabel}>
                    Phone
                  </Label>
                  <Input
                    id="th_phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    className="h-8"
                    placeholder="Mobile (optional)"
                    value={phone}
                    onChange={(e) => onPhoneChange(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="space-y-0.5">
                  <Label htmlFor="th_course_count" className={fieldLabel}>
                    Courses
                  </Label>
                  <Input
                    id="th_course_count"
                    type="number"
                    min={1}
                    max={12}
                    inputMode="numeric"
                    className="h-8"
                    value={courseCount}
                    onChange={(e) => onCourseCountChange(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="space-y-0.5">
                  <Label htmlFor="th_server_staff_id" className={fieldLabel}>
                    Server
                  </Label>
                  <Select
                    value={serverStaffId || NONE}
                    onValueChange={(v) =>
                      onServerStaffIdChange(v === NONE ? "" : v)
                    }
                  >
                    <SelectTrigger
                      id="th_server_staff_id"
                      className={compactTrigger}
                    >
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
                </div>
                <DropdownMenuSeparator />
                <div className="space-y-0.5">
                  <Label htmlFor="th_notes" className={fieldLabel}>
                    Ticket notes
                  </Label>
                  <Input
                    id="th_notes"
                    type="text"
                    className="h-8"
                    placeholder="Allergy, timing…"
                    value={notes}
                    onChange={(e) => onNotesChange(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      ) : null}

      {saleKind === "table" && !tableId ? (
        <p className="border-t px-2.5 py-1 text-[11px] text-citrus">
          Pick a table on the floor plan to start ordering.
        </p>
      ) : null}
      {needsRoom && !roomUnitId ? (
        <p className="border-t px-2.5 py-1 text-[11px] text-citrus">
          Select a room above — menu unlocks after that.
        </p>
      ) : null}
    </div>
  );
}
