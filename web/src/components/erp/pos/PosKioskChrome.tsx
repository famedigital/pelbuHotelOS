"use client";

import { posKioskLogout } from "@/app/actions/staff-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ListOrderedIcon, LogOutIcon } from "lucide-react";
import type { PosSection } from "./types";

export function PosKioskChrome({
  outletLabel,
  propertyName,
  shiftOpen,
  openTicketsCount = 0,
  onOpenTickets,
  section,
  onSection,
  showFloor = false,
}: {
  outletLabel: string;
  propertyName: string;
  shiftOpen: boolean;
  openTicketsCount?: number;
  onOpenTickets?: () => void;
  section?: PosSection;
  onSection?: (s: PosSection) => void;
  showFloor?: boolean;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b bg-card px-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">
          {outletLabel} POS
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          {propertyName}
          {" · "}
          {shiftOpen ? "Shift open" : "Open a shift before cash"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {showFloor && onSection ? (
          <nav
            aria-label="Till surface"
            className="flex items-center rounded-md border bg-muted/40 p-0.5"
          >
            <button
              type="button"
              onClick={() => onSection("menu")}
              className={cn(
                "inline-flex h-8 items-center rounded px-2.5 text-xs font-medium",
                section === "menu"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Sell
            </button>
            <button
              type="button"
              onClick={() => onSection("floor")}
              className={cn(
                "inline-flex h-8 items-center rounded px-2.5 text-xs font-medium",
                section === "floor"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Floor
            </button>
          </nav>
        ) : null}
        {onOpenTickets ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            onClick={onOpenTickets}
          >
            <ListOrderedIcon className="size-4" />
            Tickets
            {openTicketsCount > 0 ? (
              <span className="tabular-nums">{openTicketsCount}</span>
            ) : null}
          </Button>
        ) : null}
        <form action={posKioskLogout}>
          <Button type="submit" variant="outline" size="sm" className="h-9">
            <LogOutIcon className="size-4" />
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
