"use client";

import { mergeBookingsIntoGroup } from "@/app/actions/erp-reservations-party";
import type { StayHubPartyContext } from "@/app/actions/stay-hub";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTransition } from "react";
import { toast } from "sonner";

export type PartyHubTab = "rooms" | "money" | "docs";

/**
 * Slim party command bar — name, bulk actions, Rooms|Money|Docs.
 * Room switching lives in StayHubPartyRoomList (left master).
 */
export function StayHubPartyCommandBar({
  party,
  tab,
  onTabChange,
  onLinked,
  onExtendAll,
}: {
  party: StayHubPartyContext;
  tab: PartyHubTab;
  onTabChange: (tab: PartyHubTab) => void;
  onLinked?: () => void;
  onExtendAll?: () => void;
}) {
  const [pending, startTransition] = useTransition();
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
        onTabChange("rooms");
        onLinked?.();
      } else {
        toast.error(result.error ?? "Could not link group");
      }
    });
  };

  const tabs: Array<{ id: PartyHubTab; label: string }> = [
    { id: "rooms", label: "Rooming" },
    { id: "money", label: "Money" },
    { id: "docs", label: "Docs" },
  ];

  return (
    <div className="shrink-0 space-y-1.5 border-b border-border bg-muted/15 px-3 py-2 pr-12 md:px-4 md:pr-14">
      <div className="flex flex-wrap items-center gap-2">
        <p className="truncate text-sm font-semibold tracking-tight">
          {party.groupId
            ? party.groupName?.trim() || "Party"
            : party.suggested
              ? "Suggested party"
              : "Rooms"}
        </p>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {party.members.length} room
          {party.members.length === 1 ? "" : "s"}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {party.groupId && onExtendAll ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              disabled={pending}
              onClick={onExtendAll}
            >
              Extend all +1n
            </Button>
          ) : null}
          {party.groupId ? (
            <Button
              type="button"
              size="sm"
              variant="citrus"
              className="h-7 text-[11px]"
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
                    onTabChange("docs");
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
              {pending ? "…" : "Check-in all"}
            </Button>
          ) : null}
          {party.suggested ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
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
          Link as group to add/remove rooms and edit the rooming table.
        </p>
      ) : null}

      {party.groupId || party.suggested ? (
        <div className="flex max-w-md gap-1 rounded-md border border-border/70 bg-background p-0.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              disabled={!party.groupId && t.id !== "rooms"}
              className={cn(
                "h-7 flex-1 rounded px-2 text-[11px] font-medium transition-colors",
                tab === t.id
                  ? "bg-accent/15 text-accent"
                  : "text-muted-foreground hover:text-foreground",
                !party.groupId && t.id !== "rooms" && "opacity-40",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
