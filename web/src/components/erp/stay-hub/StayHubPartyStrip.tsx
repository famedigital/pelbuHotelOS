"use client";

import { mergeBookingsIntoGroup } from "@/app/actions/erp-reservations-party";
import type { StayHubPartyContext } from "@/app/actions/stay-hub";
import { RoomingListPanel } from "@/components/erp/RoomingListPanel";
import { StayHubPartyDocsPanel } from "@/components/erp/stay-hub/StayHubPartyDocsPanel";
import { StayHubPartyMasterBill } from "@/components/erp/stay-hub/StayHubPartyMasterBill";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState, useTransition } from "react";
import { toast } from "sonner";

type PartyHubTab = "rooms" | "money" | "docs";

/**
 * Party Hub strip — rooms · money · docs in one StayHub chrome (beats Absolute hop).
 */
export function StayHubPartyStrip({
  party,
  activeBookingId,
  onSwitch,
  onLinked,
}: {
  party: StayHubPartyContext;
  activeBookingId: string;
  onSwitch: (bookingId: string, assignmentId: string | null) => void;
  onLinked?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<PartyHubTab>("rooms");
  const show =
    party.members.length > 1 || party.suggested || Boolean(party.groupId);
  if (!show) return null;

  const linkGroup = () => {
    if (!party.suggested || party.members.length < 2) return;
    startTransition(async () => {
      const ids = party.members.map((m) => m.bookingId);
      const result = await mergeBookingsIntoGroup(
        ids,
        party.groupName ?? null,
      );
      if (result.ok) {
        toast.success(result.message ?? "Linked as group");
        onLinked?.();
      } else {
        toast.error(result.error ?? "Could not link group");
      }
    });
  };

  const tabs: Array<{ id: PartyHubTab; label: string }> = [
    { id: "rooms", label: "Rooms" },
    { id: "money", label: "Money" },
    { id: "docs", label: "Docs" },
  ];

  return (
    <div className="shrink-0 space-y-1.5 border-b border-border bg-muted/15 px-3 py-2 pr-12 md:px-4 md:pr-14">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          {party.groupId
            ? party.groupName?.trim() || "Party hub"
            : party.suggested
              ? "Suggested party"
              : "Rooms"}
        </p>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {party.members.length} room
          {party.members.length === 1 ? "" : "s"}
          {party.groupId ? " · formal group" : ""}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {party.groupId ? (
            <Button
              type="button"
              size="sm"
              variant="citrus"
              className="h-7 shrink-0 text-[11px]"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const { checkInParty } = await import(
                    "@/app/actions/erp-party-checkin"
                  );
                  const result = await checkInParty(party.groupId!);
                  if (result.ok) {
                    toast.success(result.message ?? "Party checked in");
                    onLinked?.();
                    setTab("docs");
                  } else {
                    toast.error(result.error ?? "Party check-in failed");
                    if (result.failed?.length) {
                      toast.message(
                        `${result.failed.length} room(s) need assign / fix`,
                      );
                    }
                  }
                });
              }}
            >
              {pending ? "Checking in…" : "Check-in all"}
            </Button>
          ) : null}
          {party.suggested ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 shrink-0 text-[11px]"
              disabled={pending}
              onClick={linkGroup}
            >
              {pending ? "Linking…" : "Link as group"}
            </Button>
          ) : null}
        </div>
      </div>

      {party.suggested ? (
        <p className="text-[11px] text-muted-foreground">
          Same agent · same dates — link to keep a formal rooming list, then
          switch rooms below.
        </p>
      ) : null}

      {party.groupId ? (
        <div className="flex gap-1 rounded-md border border-border/70 bg-background p-0.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "h-7 flex-1 rounded px-2 text-[11px] font-medium transition-colors",
                tab === t.id
                  ? "bg-accent/15 text-accent"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : null}

      {(tab === "rooms" || !party.groupId) && (
        <div className="flex flex-wrap gap-1.5">
          {party.members.map((m, i) => {
            const active = m.bookingId === activeBookingId;
            const label =
              m.roomLabel?.trim() ||
              m.confirmationCode?.trim() ||
              `Room ${i + 1}`;
            return (
              <button
                key={m.bookingId}
                type="button"
                onClick={() => {
                  if (active) return;
                  onSwitch(m.bookingId, m.assignmentId);
                }}
                title={`${m.contactName ?? "Guest"} · ${m.status.replace(/_/g, " ")}`}
                className={cn(
                  "inline-flex h-8 max-w-[9.5rem] items-center truncate rounded-md border px-2.5 text-xs font-medium transition-colors",
                  active
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-background text-foreground hover:border-accent/40 hover:bg-accent/5",
                )}
              >
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </div>
      )}

      {tab === "rooms" && party.groupId ? (
        <div className="max-h-52 overflow-y-auto rounded-md border border-border/70 bg-background p-2">
          <RoomingListPanel bookingId={activeBookingId} compact />
        </div>
      ) : null}

      {tab === "money" && party.groupId ? (
        <StayHubPartyMasterBill bookingId={activeBookingId} open />
      ) : null}

      {tab === "docs" && party.groupId ? (
        <StayHubPartyDocsPanel groupId={party.groupId} />
      ) : null}
    </div>
  );
}
