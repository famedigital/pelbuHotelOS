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

function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(`${checkIn}T00:00:00`).getTime();
  const b = new Date(`${checkOut}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
  return Math.round((b - a) / 86_400_000);
}

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
  onBookingIdChange: (v: string) => void;
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
  onBookingIdChange,
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
      <div className="grid gap-3 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
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
          <Label className="text-xs text-muted-foreground">Settle</Label>
          <Tabs
            value={settleMode}
            onValueChange={(v) =>
              onSettleModeChange(v as "cash" | "room_charge")
            }
          >
            <TabsList className="h-9 w-full">
              <TabsTrigger value="cash">Cash</TabsTrigger>
              <TabsTrigger value="room_charge">Room</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="th_booking_id" className="text-xs text-muted-foreground">
            {settleMode === "room_charge" ? "Booking folio" : "Booking (n/a)"}
          </Label>
          <Select
            value={bookingId || NONE}
            onValueChange={(v) => onBookingIdChange(v === NONE ? "" : v)}
            disabled={settleMode !== "room_charge"}
          >
            <SelectTrigger id="th_booking_id" className="w-full">
              <SelectValue
                placeholder={
                  settleMode === "room_charge" ? "Select booking" : "—"
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>
                {settleMode === "room_charge" ? "Select booking" : "—"}
              </SelectItem>
              {bookings.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {(b.contact_name ?? "Guest")} · {b.check_in} ·{" "}
                  {nightsBetween(b.check_in, b.check_out)}n · {b.status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
