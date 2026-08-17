"use client";

import type { StayHubPartyContext } from "@/app/actions/stay-hub";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";

type StatusFilter = "all" | "held" | "confirmed" | "checked_in" | "other";

function memberStatusBucket(status: string): StatusFilter {
  if (status === "held" || status === "pending") return "held";
  if (status === "confirmed") return "confirmed";
  if (status === "checked_in") return "checked_in";
  return "other";
}

function statusDotClass(status: string): string {
  if (status === "checked_in") return "bg-citrus";
  if (status === "confirmed") return "bg-sky-500";
  if (status === "held" || status === "pending") return "bg-amber-500";
  if (status === "cancelled" || status === "no_show") return "bg-maroon";
  return "bg-muted-foreground/40";
}

/**
 * Vertical master list for StayHub party mode — select a sibling room.
 */
export function StayHubPartyRoomList({
  party,
  activeBookingId,
  onSwitch,
  side = "left",
  className,
}: {
  party: StayHubPartyContext;
  activeBookingId: string;
  onSwitch: (bookingId: string, assignmentId: string | null) => void;
  side?: "left" | "right";
  className?: string;
}) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const listRef = useRef<HTMLDivElement>(null);

  const sorted = useMemo(() => {
    return [...party.members].sort((a, b) => {
      const la = (a.roomLabel ?? a.confirmationCode ?? "").localeCompare(
        b.roomLabel ?? b.confirmationCode ?? "",
        undefined,
        { numeric: true },
      );
      return la;
    });
  }, [party.members]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return sorted.filter((m) => {
      if (
        statusFilter !== "all" &&
        memberStatusBucket(m.status) !== statusFilter
      ) {
        return false;
      }
      if (!needle) return true;
      const hay = [
        m.roomLabel,
        m.confirmationCode,
        m.contactName,
        m.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [sorted, q, statusFilter]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const idx = filtered.findIndex((m) => m.bookingId === activeBookingId);
      if (idx < 0) return;
      e.preventDefault();
      const next =
        e.key === "ArrowDown"
          ? filtered[Math.min(filtered.length - 1, idx + 1)]
          : filtered[Math.max(0, idx - 1)];
      if (next && next.bookingId !== activeBookingId) {
        onSwitch(next.bookingId, next.assignmentId);
      }
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [filtered, activeBookingId, onSwitch]);

  const filters: { id: StatusFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "held", label: "Held" },
    { id: "confirmed", label: "Conf" },
    { id: "checked_in", label: "In" },
  ];

  return (
    <aside
      ref={listRef}
      tabIndex={0}
      className={cn(
        "hidden min-h-0 w-[13.5rem] shrink-0 flex-col bg-muted/10 outline-none focus-visible:ring-2 focus-visible:ring-ring/40 md:flex lg:w-56",
        side === "right" ? "border-l border-border" : "border-r border-border",
        className,
      )}
      aria-label="Party rooms"
    >
      <div className="shrink-0 space-y-1.5 border-b border-border/60 p-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find room / guest"
          className="h-8 text-xs"
          aria-label="Search rooms"
        />
        <div className="flex flex-wrap gap-0.5">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={cn(
                "h-6 rounded px-1.5 text-[10px] font-medium",
                statusFilter === f.id
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {filtered.length === 0 ? (
          <p className="px-2 py-4 text-center text-[11px] text-muted-foreground">
            No rooms match
          </p>
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((m, i) => {
              const active = m.bookingId === activeBookingId;
              const label =
                m.roomLabel?.trim() ||
                m.confirmationCode?.trim() ||
                `Room ${i + 1}`;
              const guest =
                m.contactName?.trim().split(/\s+/).slice(-1)[0] ?? "";
              return (
                <li key={m.bookingId}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!active) onSwitch(m.bookingId, m.assignmentId);
                    }}
                    className={cn(
                      "flex w-full items-start gap-1.5 rounded-md border px-2 py-1.5 text-left transition-colors",
                      active
                        ? "border-accent bg-accent/10"
                        : "border-transparent hover:border-border hover:bg-background",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1.5 size-1.5 shrink-0 rounded-full",
                        statusDotClass(m.status),
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold tabular-nums">
                        {label}
                      </span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {guest || m.status.replace(/_/g, " ")}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="shrink-0 border-t border-border/50 px-2 py-1 text-[9px] text-muted-foreground">
        ↑↓ switch rooms · {filtered.length}/{party.members.length}
      </p>
    </aside>
  );
}
