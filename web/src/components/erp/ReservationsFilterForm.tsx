"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  firstDayOfMonth,
  lastDayOfMonth,
  syncToWithFrom,
} from "@/lib/erp/reservation-date-range";
import { thimphuDateOffset, thimphuToday } from "@/lib/erp-lists";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef } from "react";

const STATUSES = [
  "held",
  "pending",
  "confirmed",
  "checked_in",
  "checked_out",
  "cancelled",
  "no_show",
] as const;

const selectClass =
  "h-10 w-full min-w-[9.5rem] rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

export function ReservationsFilterForm({
  q,
  status,
  source,
  roomFilter,
  checkInFrom,
  checkInTo,
  sort,
  bucket,
  worklist,
  hasActiveFilters,
}: {
  q: string;
  status: string;
  source: string;
  roomFilter: string;
  checkInFrom: string;
  checkInTo: string;
  sort: string;
  bucket: string;
  worklist: string;
  hasActiveFilters: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fromRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);

  const submit = useCallback(() => {
    formRef.current?.requestSubmit();
  }, []);

  const setRangeAndSubmit = useCallback(
    (from: string, to: string) => {
      if (fromRef.current) fromRef.current.value = from;
      if (toRef.current) toRef.current.value = to;
      // brief tick so controlled-looking DOM values flush before submit
      queueMicrotask(submit);
    },
    [submit],
  );

  const onFromChange = () => {
    const from = fromRef.current?.value ?? "";
    const to = toRef.current?.value ?? "";
    if (!from) {
      submit();
      return;
    }
    const nextTo = syncToWithFrom(from, to);
    if (toRef.current && nextTo !== to) {
      toRef.current.value = nextTo;
    }
    submit();
  };

  const onToChange = () => {
    const from = fromRef.current?.value ?? "";
    const to = toRef.current?.value ?? "";
    if (from && to && to < from && fromRef.current) {
      // keep window valid: bump From down if To moved earlier
      fromRef.current.value = to;
    }
    submit();
  };

  const presets = (() => {
    const today = thimphuToday();
    const monthStart = firstDayOfMonth(today);
    const monthEnd = lastDayOfMonth(today);
    const weekEnd = thimphuDateOffset(today, 6);
    const next30 = thimphuDateOffset(today, 30);
    return [
      { id: "today", label: "Today", from: today, to: today },
      { id: "week", label: "7 days", from: today, to: weekEnd },
      { id: "month", label: "This month", from: monthStart, to: monthEnd },
      { id: "next30", label: "Next 30", from: today, to: next30 },
    ] as const;
  })();

  return (
    <form
      ref={formRef}
      className="w-full space-y-3"
      action="/erp/reservations"
      method="get"
    >
      {bucket && bucket !== "all" ? (
        <input type="hidden" name="bucket" value={bucket} />
      ) : null}
      {worklist ? (
        <input type="hidden" name="worklist" value={worklist} />
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1 space-y-1.5">
          <label
            htmlFor="q"
            className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
          >
            Search
          </label>
          <Input
            id="q"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Conf # · guest · phone · agent · room"
            className="h-10 bg-background"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <div className="space-y-1.5">
            <label
              htmlFor="status"
              className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
            >
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={status}
              className={selectClass}
              onChange={submit}
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="room"
              className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
            >
              Rooms
            </label>
            <select
              id="room"
              name="room"
              defaultValue={roomFilter === "all" ? "" : roomFilter}
              className={selectClass}
              onChange={submit}
            >
              <option value="">All room fits</option>
              <option value="needs_room">Needs room</option>
              <option value="partial">Partial only</option>
              <option value="assigned">Fully assigned</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="sort"
              className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
            >
              Sort
            </label>
            <select
              id="sort"
              name="sort"
              defaultValue={sort}
              className={selectClass}
              onChange={submit}
            >
              <option value="check_in_desc">Arrival · latest</option>
              <option value="check_in_asc">Arrival · soonest</option>
              <option value="needs_room_first">Needs room first</option>
              <option value="created_desc">Recently created</option>
              <option value="name_asc">Guest A–Z</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="source"
              className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
            >
              Source
            </label>
            <Input
              id="source"
              name="source"
              defaultValue={source}
              placeholder="e.g. agent"
              className="h-10 bg-background"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border/80 bg-muted/25 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
        <div className="min-w-0 sm:mr-1">
          <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Arrival window
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Check-in from / to. Changing From snaps To to the same month.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label
              htmlFor="check_in_from"
              className="text-[10px] font-medium text-muted-foreground"
            >
              From
            </label>
            <input
              ref={fromRef}
              id="check_in_from"
              type="date"
              name="check_in_from"
              defaultValue={checkInFrom}
              className="border-input flex h-10 w-[10.75rem] rounded-md border bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              onChange={onFromChange}
            />
          </div>
          <span
            className="mb-2.5 hidden text-muted-foreground sm:inline"
            aria-hidden
          >
            –
          </span>
          <div className="space-y-1">
            <label
              htmlFor="check_in_to"
              className="text-[10px] font-medium text-muted-foreground"
            >
              To
            </label>
            <input
              ref={toRef}
              id="check_in_to"
              type="date"
              name="check_in_to"
              defaultValue={checkInTo}
              className="border-input flex h-10 w-[10.75rem] rounded-md border bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              onChange={onToChange}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
          {presets.map((p) => {
            const on =
              checkInFrom === p.from && checkInTo === p.to
                ? "true"
                : "false";
            return (
              <button
                key={p.id}
                type="button"
                data-on={on}
                onClick={() => setRangeAndSubmit(p.from, p.to)}
                className="h-8 rounded-md border border-border bg-background px-2.5 text-[11px] font-medium text-foreground transition-colors hover:border-accent/40 hover:bg-accent/5 data-[on=true]:border-accent/50 data-[on=true]:bg-accent/10 data-[on=true]:text-accent"
              >
                {p.label}
              </button>
            );
          })}
          <Button type="submit" variant="outline" className="h-8 px-3 text-xs">
            Apply
          </Button>
          {hasActiveFilters ? (
            <Button
              type="button"
              variant="ghost"
              className="h-8 px-3 text-xs"
              onClick={() => router.push("/erp/reservations")}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      {hasActiveFilters && !checkInFrom && !checkInTo ? (
        <p className="sr-only">Filters active</p>
      ) : null}

      {/* Clear link for progressive enhancement without JS router */}
      {hasActiveFilters ? (
        <noscript>
          <Link href="/erp/reservations" className="text-xs text-accent">
            Clear filters
          </Link>
        </noscript>
      ) : null}
    </form>
  );
}
