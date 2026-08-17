"use client";

import { mergeBookingsIntoGroup } from "@/app/actions/erp-reservations-party";
import type { BookingRow } from "@/components/erp/BookingsTable";
import { AgentNameLink } from "@/components/erp/AgentNameLink";
import { BookingDetailPanelLoader } from "@/components/erp/BookingDetailPanelLoader";
import { RoomingListPanel } from "@/components/erp/RoomingListPanel";
import { Button } from "@/components/ui/button";
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
import {
  partyRoomFit,
  type ReservationParty,
} from "@/lib/erp/reservation-party";
import { statusStripeClass } from "@/lib/erp/reservation-status-buckets";
import { useStayHubOptional } from "@/components/erp/StayHubProvider";
import { recommendStayHubStep } from "@/lib/folio/stay-hub-cycle";
import { seedStayFromBoardRow } from "@/lib/folio/stay-hub-seed";
import { bookingConfirmationLabel } from "@/lib/booking-ref";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { BookingLifecycleActions } from "@/components/erp/BookingLifecycleActions";
import { fmtDate as formatStayDate } from "@/lib/erp-lists";

function fmtDate(iso: string | null): string {
  return formatStayDate(iso);
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

function PartyRoomCell({ party }: { party: ReservationParty }) {
  const fit = partyRoomFit(party);
  const labels = party.roomLabels.join(", ");
  if (fit === "none") {
    return <span className="font-medium text-destructive">No rooms</span>;
  }
  if (fit === "partial") {
    return (
      <span className="text-amber-800 dark:text-amber-200">
        <span className="font-medium">
          Partial ({party.assignedCount}/{party.roomsSold})
        </span>
        {labels ? (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {labels}
          </span>
        ) : null}
      </span>
    );
  }
  if (labels) {
    return (
      <span className="font-medium tabular-nums text-foreground">{labels}</span>
    );
  }
  return <span className="text-muted-foreground">—</span>;
}

function KindChip({ kind }: { kind: ReservationParty["kind"] }) {
  if (kind === "single") return null;
  const label = kind === "group" ? "Party" : "Suggested";
  const tone =
    kind === "group"
      ? "border-accent/40 bg-accent/10 text-accent"
      : "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`}
    >
      {label}
    </span>
  );
}

function PartySummary({ party }: { party: ReservationParty }) {
  const multi = party.members.length > 1;
  return (
    <div className="flex w-full min-w-0 flex-col gap-2 pr-2 text-left sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1 sm:max-w-[14rem]">
        <div className="flex flex-wrap items-center gap-1.5">
          <KindChip kind={party.kind} />
          <p className="font-medium text-foreground">{party.label}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          {multi
            ? `${party.members.length} reservations · ${party.roomsSold} rooms`
            : `${bookingConfirmationLabel({
                confirmationCode: party.members[0]?.confirmation_code,
                bookingId: party.members[0]?.id,
              })} · ${party.members[0]?.contact_phone ?? "—"}`}
        </p>
      </div>
      <div className="hidden shrink-0 text-sm sm:block sm:w-[10rem]">
        {fmtDate(party.checkIn)} → {fmtDate(party.checkOut)}
      </div>
      <div className="hidden shrink-0 text-sm text-muted-foreground md:block md:w-[8rem]">
        {party.agentName ? (
          <AgentNameLink
            agentId={party.agentId}
            name={party.agentName}
            className="text-sm"
          />
        ) : (
          <span className="text-foreground">
            {party.members[0]?.source ?? "—"}
          </span>
        )}
      </div>
      <div className="hidden shrink-0 text-sm lg:block lg:w-[7.5rem]">
        <PartyRoomCell party={party} />
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 sm:justify-end">
        <StatusPill value={party.primaryStatus ?? ""} />
        {multi ? (
          <BadgePill
            badge={{
              key: "rooms",
              label: `${party.roomsSold} rm`,
              tone: "info",
            }}
          />
        ) : null}
        {(party.members[0]?.badges ?? []).slice(0, multi ? 0 : 2).map((b) => (
          <BadgePill key={b.key} badge={b} />
        ))}
      </div>
    </div>
  );
}

function MemberRow({
  row,
  selected,
  onToggle,
  canSelect,
}: {
  row: BookingRow;
  selected: boolean;
  onToggle: (id: string) => void;
  canSelect: boolean;
}) {
  const router = useRouter();
  const stayHub = useStayHubOptional();
  const stripe = statusStripeClass(row.status);
  const canCi =
    row.status === "confirmed" ||
    row.status === "held" ||
    row.status === "pending";
  const inHouse = row.status === "checked_in";

  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-background/80 px-2.5 py-2 pl-2 ${stripe}`}
    >
      {canSelect ? (
        <input
          type="checkbox"
          className="size-4 shrink-0 accent-[var(--accent)]"
          checked={selected}
          onChange={() => onToggle(row.id)}
          aria-label={`Select ${row.contact_name ?? row.id}`}
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">
          {row.contact_name ?? "Guest"}
          {row.room_labels ? (
            <span className="ml-2 font-mono text-xs text-accent">
              {row.room_labels}
            </span>
          ) : (
            <span className="ml-2 text-xs text-destructive">No room</span>
          )}
        </p>
        <p className="font-mono text-[11px] text-muted-foreground">
          {bookingConfirmationLabel({
            confirmationCode: row.confirmation_code,
            bookingId: row.id,
          })}{" "}
          · {row.status?.replace(/_/g, " ")}
        </p>
      </div>
      <div className="flex flex-wrap gap-1">
        {stayHub ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() =>
                stayHub.openStayHub({
                  bookingId: row.id,
                  step: recommendStayHubStep({
                    status: row.status ?? "confirmed",
                    hasRoomAssigned: (row.assigned_count ?? 0) > 0,
                    board: "reservations",
                  }),
                  board: "reservations",
                  seedStay: seedStayFromBoardRow(row),
                })
              }
            >
              StayHub
            </Button>
            {canCi ? (
              <Button
                type="button"
                size="sm"
                variant="citrus"
                className="h-8 text-xs"
                onClick={() =>
                  stayHub.openStayHub({
                    bookingId: row.id,
                    step: "check_in",
                    board: "arrivals",
                    seedStay: seedStayFromBoardRow(row),
                  })
                }
              >
                Check-in
              </Button>
            ) : null}
            {inHouse ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() =>
                  stayHub.openStayHub({
                    bookingId: row.id,
                    step: "stay_money",
                    board: "in_house",
                    seedStay: seedStayFromBoardRow(row),
                  })
                }
              >
                Folio
              </Button>
            ) : null}
          </>
        ) : null}
        <Button asChild size="sm" variant="ghost" className="h-8 text-xs">
          <Link href={boardActionHref(row.status, row.id, "reservations")}>
            {row.action_label ?? boardActionLabel(row.status)}
          </Link>
        </Button>
        {canCi || row.status === "checked_in" ? (
          <div className="w-full basis-full sm:w-auto sm:basis-auto">
            <BookingLifecycleActions
              bookingId={row.id}
              status={row.status ?? "confirmed"}
              compact
              onSuccess={() => {
                toast.message("Updated");
                router.refresh();
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ReservationsPartyBoard({
  parties,
  emptyMessage = "No reservations match.",
}: {
  parties: ReservationParty[];
  emptyMessage?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkId = searchParams.get("id") ?? searchParams.get("q");
  const matchedPartyId = useMemo(() => {
    if (!deepLinkId) return undefined;
    for (const p of parties) {
      if (p.id === deepLinkId || p.groupId === deepLinkId) return p.id;
      if (p.members.some((m) => m.id === deepLinkId || m.id.startsWith(deepLinkId))) {
        return p.id;
      }
    }
    return undefined;
  }, [deepLinkId, parties]);

  const [openId, setOpenId] = useState<string | undefined>(matchedPartyId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (matchedPartyId) setOpenId(matchedPartyId);
  }, [matchedPartyId]);

  // Drop stale accordion value after party ids change (suggested → group:…).
  useEffect(() => {
    if (!openId) return;
    if (parties.length === 0) return;
    if (!parties.some((p) => p.id === openId)) {
      setOpenId(undefined);
    }
  }, [parties, openId]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function linkParty(memberIds: string[], name?: string) {
    startTransition(async () => {
      // Collapse before refresh — open accordion + remounted party ids leave
      // Radix content-height animation stuck (huge empty white band).
      setOpenId(undefined);
      const res = await mergeBookingsIntoGroup(memberIds, name);
      if (!res.ok) {
        toast.error(res.error ?? "Could not link party");
        return;
      }
      toast.success(res.message ?? "Party linked");
      setSelected(new Set());
      router.refresh();
    });
  }

  const stayHub = useStayHubOptional();
  const selectedCount = selected.size;

  const selectedMembers = useMemo(() => {
    const ids = selected;
    const out: BookingRow[] = [];
    for (const p of parties) {
      for (const m of p.members) {
        if (ids.has(m.id)) out.push(m);
      }
    }
    return out;
  }, [parties, selected]);

  function openStayHubFor(
    rows: BookingRow[],
    prefer: "check_in" | "stay_money" | "check_out",
  ) {
    if (!stayHub || rows.length === 0) return;
    const first = rows[0]!;
    stayHub.openStayHub({
      bookingId: first.id,
      step: recommendStayHubStep({
        status: first.status ?? "confirmed",
        hasRoomAssigned: (first.assigned_count ?? 0) > 0,
        board:
          prefer === "check_in"
            ? "arrivals"
            : prefer === "check_out"
              ? "departures"
              : "in_house",
      }),
      board:
        prefer === "check_in"
          ? "arrivals"
          : prefer === "check_out"
            ? "departures"
            : "in_house",
      seedStay: seedStayFromBoardRow(first),
    });
    if (rows.length > 1) {
      toast.message(
        `Party: ${rows.length} rooms — use room chips in StayHub to switch.`,
      );
    }
  }

  function bulkOpenCheckIn() {
    const ready = selectedMembers.filter(
      (m) =>
        m.status === "confirmed" ||
        m.status === "held" ||
        m.status === "pending",
    );
    if (ready.length === 0) {
      toast.error("Select confirmed / held rooms ready for check-in");
      return;
    }
    openStayHubFor(ready, "check_in");
  }

  function bulkOpenCollect() {
    const inHouse = selectedMembers.filter((m) => m.status === "checked_in");
    if (inHouse.length === 0) {
      toast.error("Select checked-in rooms for master collect");
      return;
    }
    openStayHubFor(inHouse, "stay_money");
  }

  if (parties.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {selectedCount >= 1 ? (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-accent/40 bg-card/95 px-3 py-2.5 shadow-sm backdrop-blur">
          <p className="text-sm text-foreground">
            <span className="font-semibold tabular-nums">{selectedCount}</span>{" "}
            selected
          </p>
          {stayHub ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="citrus"
                disabled={pending}
                onClick={bulkOpenCheckIn}
              >
                Check-in selected
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={bulkOpenCollect}
              >
                Open master collect
              </Button>
            </>
          ) : null}
          {selectedCount >= 2 ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => linkParty([...selected])}
            >
              {pending ? "Linking…" : "Merge into group"}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => setSelected(new Set())}
          >
            Clear
          </Button>
        </div>
      ) : null}

      <Accordion
        type="single"
        collapsible
        value={openId ?? ""}
        onValueChange={(v) => setOpenId(v || undefined)}
        className="rounded-xl border border-border bg-card"
      >
        <div
          className="hidden border-b bg-muted/30 px-4 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase sm:grid sm:grid-cols-[1fr_10rem_8rem_7.5rem_auto] sm:gap-4 md:grid-cols-[14rem_10rem_8rem_7.5rem_1fr]"
          aria-hidden
        >
          <span>Party / guest</span>
          <span className="hidden sm:inline">Dates</span>
          <span className="hidden md:inline">Agent</span>
          <span className="hidden lg:inline">Rooms</span>
          <span className="hidden sm:inline">Status</span>
        </div>

        {parties.map((party) => {
          const multi = party.members.length > 1;
          const detailId = party.members[0]!.id;
          const selectable =
            party.kind !== "group" || party.members.length === 1;
          const inHouseIds = party.members
            .filter((m) => m.status === "checked_in")
            .map((m) => m.id);
          const folioIdGuess = party.members.find(
            (m) => m.status === "checked_in",
          )?.id;

          return (
            <AccordionItem
              key={party.id}
              value={party.id}
              className={`border-b border-border/70 px-3 last:border-b-0 sm:px-4 ${statusStripeClass(party.primaryStatus)}`}
            >
              <AccordionTrigger className="py-3 hover:no-underline sm:py-3.5">
                <PartySummary party={party} />
              </AccordionTrigger>
              <AccordionContent className="border-t border-border/50 bg-muted/10 px-1 pb-4 pt-3 sm:px-2">
                {openId === party.id ? (
                  <>
                {party.kind === "suggested" ? (
                  <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-50/40 px-3 py-2 dark:bg-amber-950/20">
                    <p className="flex-1 text-xs text-foreground">
                      <span className="font-medium">Link as group</span> to
                      add/remove rooms and open the formal rooming list in
                      StayHub.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="citrus"
                      className="h-8"
                      disabled={pending}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        linkParty(
                          party.members.map((m) => m.id),
                          party.label,
                        );
                      }}
                    >
                      {pending ? "Linking…" : "Link as group"}
                    </Button>
                  </div>
                ) : null}

                {multi ? (
                  <div className="mb-3 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                        Rooms under this party
                      </p>
                      {stayHub ? (
                        <div className="ml-auto flex flex-wrap gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="citrus"
                            className="h-8 text-xs"
                            onClick={() => {
                              const ready = party.members.filter(
                                (m) =>
                                  m.status === "confirmed" ||
                                  m.status === "held" ||
                                  m.status === "pending",
                              );
                              if (ready.length === 0) {
                                toast.error("No rooms ready for check-in");
                                return;
                              }
                              openStayHubFor(ready, "check_in");
                            }}
                          >
                            Check-in party
                          </Button>
                          {inHouseIds.length > 0 ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                              onClick={() =>
                                openStayHubFor(
                                  party.members.filter(
                                    (m) => m.status === "checked_in",
                                  ),
                                  "stay_money",
                                )
                              }
                            >
                              Collect / settle
                            </Button>
                          ) : null}
                          {folioIdGuess ? (
                            <Button
                              asChild
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs"
                            >
                              <Link href={`/erp/folios?q=${folioIdGuess}`}>
                                Folios
                              </Link>
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    {party.members.map((m) => (
                      <MemberRow
                        key={m.id}
                        row={m}
                        selected={selected.has(m.id)}
                        onToggle={toggleSelect}
                        canSelect
                      />
                    ))}
                  </div>
                ) : selectable ? (
                  <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--accent)]"
                      checked={selected.has(detailId)}
                      onChange={() => toggleSelect(detailId)}
                      aria-label="Select reservation for merge or bulk CI"
                    />
                    Select for party merge or bulk check-in / collect
                  </div>
                ) : null}

                  <div className="space-y-3">
                    <RoomingListPanel bookingId={detailId} compact />
                    {!multi ? (
                      <BookingDetailPanelLoader
                        bookingId={detailId}
                        compact
                      />
                    ) : null}
                    {party.groupId ? (
                      <p className="text-xs text-muted-foreground">
                        <Link
                          href="/erp/group"
                          className="font-medium text-accent underline-offset-4 hover:underline"
                        >
                          Open groups desk
                        </Link>{" "}
                        for deposits &amp; AR statement.
                      </p>
                    ) : null}
                  </div>
                  </>
                ) : null}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
