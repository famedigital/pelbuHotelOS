"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  firstDayOfMonth,
  lastDayOfMonth,
  syncToWithFrom,
} from "@/lib/erp/reservation-date-range";
import { thimphuDateOffset, thimphuToday } from "@/lib/erp-lists";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, type RefObject } from "react";

const STATUSES = [
  "held",
  "pending",
  "confirmed",
  "checked_in",
  "checked_out",
  "cancelled",
  "no_show",
] as const;

const ALL = "__all";

function FilterSelect({
  name,
  label,
  value,
  options,
  widthClass,
  inputRef,
  onCommit,
}: {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  widthClass: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onCommit: () => void;
}) {
  return (
    <div className={widthClass}>
      <label htmlFor={name} className="sr-only">
        {label}
      </label>
      <input ref={inputRef} type="hidden" name={name} defaultValue={value} />
      <Select
        defaultValue={value || ALL}
        onValueChange={(next) => {
          if (inputRef.current) {
            inputRef.current.value = next === ALL ? "" : next;
          }
          onCommit();
        }}
      >
        <SelectTrigger id={name} size="sm" className="bg-background">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value || ALL} value={opt.value || ALL}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

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
  const statusRef = useRef<HTMLInputElement>(null);
  const roomRef = useRef<HTMLInputElement>(null);
  const sortRef = useRef<HTMLInputElement>(null);

  const submit = useCallback(() => {
    formRef.current?.requestSubmit();
  }, []);

  const setRangeAndSubmit = useCallback(
    (from: string, to: string) => {
      if (fromRef.current) fromRef.current.value = from;
      if (toRef.current) toRef.current.value = to;
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

  const dateClass =
    "border-input h-8 w-[9.25rem] rounded-md border bg-background px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

  return (
    <form
      ref={formRef}
      className="flex w-full flex-wrap items-center gap-2"
      action="/erp/reservations"
      method="get"
    >
      {bucket && bucket !== "all" ? (
        <input type="hidden" name="bucket" value={bucket} />
      ) : null}
      {worklist ? (
        <input type="hidden" name="worklist" value={worklist} />
      ) : null}

      <div className="min-w-[12rem] flex-1">
        <label htmlFor="q" className="sr-only">
          Search
        </label>
        <Input
          id="q"
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search conf #, guest, phone, agent, room"
          className="h-8 bg-background"
        />
      </div>

      <FilterSelect
        name="status"
        label="Status"
        value={status}
        widthClass="w-[9.25rem]"
        inputRef={statusRef}
        onCommit={() => queueMicrotask(submit)}
        options={[
          { value: "", label: "All statuses" },
          ...STATUSES.map((s) => ({
            value: s,
            label: s.replace(/_/g, " "),
          })),
        ]}
      />
      <FilterSelect
        name="room"
        label="Rooms"
        value={roomFilter === "all" ? "" : roomFilter}
        widthClass="w-[9.25rem]"
        inputRef={roomRef}
        onCommit={() => queueMicrotask(submit)}
        options={[
          { value: "", label: "All room fits" },
          { value: "needs_room", label: "Needs room" },
          { value: "partial", label: "Partial only" },
          { value: "assigned", label: "Fully assigned" },
        ]}
      />
      <FilterSelect
        name="sort"
        label="Sort"
        value={sort}
        widthClass="w-[10.5rem]"
        inputRef={sortRef}
        onCommit={() => queueMicrotask(submit)}
        options={[
          { value: "check_in_desc", label: "Arrival · latest" },
          { value: "check_in_asc", label: "Arrival · soonest" },
          { value: "needs_room_first", label: "Needs room first" },
          { value: "created_desc", label: "Recently created" },
          { value: "name_asc", label: "Guest A–Z" },
        ]}
      />

      <div className="w-[7.5rem]">
        <label htmlFor="source" className="sr-only">
          Source
        </label>
        <Input
          id="source"
          name="source"
          defaultValue={source}
          placeholder="Source"
          className="h-8 bg-background"
        />
      </div>

      <div className="flex items-center gap-1.5">
        <label htmlFor="check_in_from" className="sr-only">
          Arrival from
        </label>
        <input
          ref={fromRef}
          id="check_in_from"
          type="date"
          name="check_in_from"
          defaultValue={checkInFrom}
          className={dateClass}
          onChange={onFromChange}
        />
        <span className="text-muted-foreground" aria-hidden>
          –
        </span>
        <label htmlFor="check_in_to" className="sr-only">
          Arrival to
        </label>
        <input
          ref={toRef}
          id="check_in_to"
          type="date"
          name="check_in_to"
          defaultValue={checkInTo}
          className={dateClass}
          onChange={onToChange}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {presets.map((p) => {
          const on = checkInFrom === p.from && checkInTo === p.to;
          return (
            <Button
              key={p.id}
              type="button"
              size="sm"
              variant={on ? "secondary" : "outline"}
              className="h-8 bg-background"
              onClick={() => setRangeAndSubmit(p.from, p.to)}
            >
              {p.label}
            </Button>
          );
        })}
        <Button type="submit" size="sm" variant="outline" className="h-8">
          Apply
        </Button>
        {hasActiveFilters ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8"
            onClick={() => router.push("/erp/reservations")}
          >
            Clear
          </Button>
        ) : null}
      </div>

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
