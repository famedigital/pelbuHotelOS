"use client";

import type { BookingRow } from "@/components/erp/BookingsTable";
import { BookingDetailPanelLoader } from "@/components/erp/BookingDetailPanelLoader";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  boardActionHref,
  boardActionLabel,
  type ArrivalBadge,
} from "@/lib/arrival-board";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return iso;
}

function StatusPill({ value }: { value: string }) {
  if (!value) return null;
  const tone =
    value === "checked_in" || value === "open"
      ? "border-citrus/40 bg-citrus-tint/60 text-citrus"
      : value === "confirmed"
        ? "border-accent/30 bg-accent/10 text-accent"
        : value === "held" || value === "pending"
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : value === "checked_out" ||
              value === "cancelled" ||
              value === "no_show"
            ? "border-border bg-muted text-muted-foreground"
            : "border-border bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase whitespace-nowrap ${tone}`}
    >
      {value.replace(/_/g, " ")}
    </span>
  );
}

function BadgePill({ badge }: { badge: ArrivalBadge }) {
  const tone =
    badge.tone === "danger"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : badge.tone === "warn"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
        : badge.tone === "ok"
          ? "border-citrus/40 bg-citrus-tint/50 text-citrus"
          : "border-border bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex max-w-[9rem] truncate items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${tone}`}
      title={badge.label}
    >
      {badge.label}
    </span>
  );
}

function RowSummary({ row }: { row: BookingRow }) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-2 pr-2 text-left sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1 sm:max-w-[14rem]">
        <p className="font-medium text-foreground">
          {row.contact_name ?? "Guest"}
        </p>
        <p className="font-mono text-xs text-muted-foreground">
          {row.id.slice(0, 8)} · {row.contact_phone ?? "—"}
        </p>
      </div>
      <div className="hidden shrink-0 text-sm sm:block sm:w-[10rem]">
        {fmtDate(row.check_in)} → {fmtDate(row.check_out)}
      </div>
      <div className="hidden shrink-0 text-sm text-muted-foreground md:block md:w-[8rem]">
        <span className="text-foreground">{row.source ?? "—"}</span>
        {row.agent_name ? (
          <span className="block truncate">{row.agent_name}</span>
        ) : null}
      </div>
      <div className="hidden shrink-0 text-sm tabular-nums lg:block lg:w-[6rem]">
        {Number(row.rooms ?? 0)} / {Number(row.adults ?? 0)} pax
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 sm:justify-end">
        <StatusPill value={row.status ?? ""} />
        {(row.badges ?? []).map((b) => (
          <BadgePill key={b.key} badge={b} />
        ))}
      </div>
      <Link
        href={boardActionHref(row.status, row.id)}
        className="hidden shrink-0 items-center rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted xl:inline-flex"
        onClick={(e) => e.stopPropagation()}
      >
        {row.action_label ?? boardActionLabel(row.status)} →
      </Link>
    </div>
  );
}

function MobileRowSummary({ row }: { row: BookingRow }) {
  return (
    <div className="flex w-full flex-col gap-2 pr-2 text-left">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">
            {row.contact_name ?? "Guest"}
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            {row.id.slice(0, 8)} · {row.contact_phone ?? "—"}
          </p>
        </div>
        <StatusPill value={row.status ?? ""} />
      </div>
      <p className="text-sm text-foreground">
        {fmtDate(row.check_in)} → {fmtDate(row.check_out)}
      </p>
      <p className="text-sm text-muted-foreground">
        {row.source ?? "—"}
        {row.agent_name ? ` · ${row.agent_name}` : ""}
      </p>
      <p className="text-sm tabular-nums text-muted-foreground">
        {Number(row.rooms ?? 0)} rooms / {Number(row.adults ?? 0)} pax
        {row.room_labels ? ` · ${row.room_labels}` : ""}
      </p>
      {(row.badges?.length ?? 0) > 0 ? (
        <div className="flex flex-wrap gap-1">
          {row.badges?.map((badge) => (
            <BadgePill key={badge.key} badge={badge} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ReservationsAccordionTable({
  data,
  emptyMessage = "No reservations match.",
}: {
  data: BookingRow[];
  emptyMessage?: string;
}) {
  const searchParams = useSearchParams();
  const deepLinkId = searchParams.get("id") ?? searchParams.get("q");
  const matchedDeepLink =
    deepLinkId && data.some((r) => r.id === deepLinkId || r.id.startsWith(deepLinkId))
      ? data.find((r) => r.id === deepLinkId || r.id.startsWith(deepLinkId))?.id
      : undefined;

  const [openId, setOpenId] = useState<string | undefined>(matchedDeepLink);

  useEffect(() => {
    if (matchedDeepLink) setOpenId(matchedDeepLink);
  }, [matchedDeepLink]);

  if (data.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <Accordion
      type="single"
      collapsible
      value={openId}
      onValueChange={setOpenId}
      className="rounded-xl border border-border bg-card"
    >
      <div
        className="hidden border-b bg-muted/30 px-4 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase sm:grid sm:grid-cols-[1fr_10rem_8rem_6rem_auto] sm:gap-4 md:grid-cols-[14rem_10rem_8rem_6rem_1fr_auto]"
        aria-hidden
      >
        <span>Guest</span>
        <span className="hidden sm:inline">Dates</span>
        <span className="hidden md:inline">Source</span>
        <span className="hidden lg:inline">Rooms</span>
        <span className="hidden sm:inline sm:col-span-1 md:col-span-1">
          Readiness
        </span>
        <span className="hidden xl:inline">Action</span>
      </div>

      {data.map((row) => (
        <AccordionItem
          key={row.id}
          value={row.id}
          className="border-b border-border/70 px-3 last:border-b-0 sm:px-4"
        >
          <AccordionTrigger className="py-3 hover:no-underline sm:py-3.5">
            <span className="hidden w-full sm:block">
              <RowSummary row={row} />
            </span>
            <span className="w-full sm:hidden">
              <MobileRowSummary row={row} />
            </span>
          </AccordionTrigger>
          <AccordionContent className="border-t border-border/50 bg-muted/10 px-1 pb-4 pt-3 sm:px-2">
            {openId === row.id ? (
              <BookingDetailPanelLoader bookingId={row.id} compact />
            ) : null}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
