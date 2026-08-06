"use client";

import {
  DoorOpenIcon,
  KeyboardIcon,
  ListOrderedIcon,
  ShoppingBagIcon,
  UtensilsCrossedIcon,
} from "lucide-react";
import type { ReactNode } from "react";

export type PosSaleKind = "table" | "room" | "counter";

type Props = {
  onPick: (kind: PosSaleKind) => void;
  tableCount: number;
  roomCount: number;
  openTicketCount: number;
  onOpenTickets?: () => void;
  /** Last used path — one-tap resume. */
  lastKind?: PosSaleKind | null;
  onOpenHelp?: () => void;
};

/**
 * First screen of the POS register — pick sale context before the menu opens.
 * Table → floor plan · Room → in-house folio · Counter → walk-in / pay now.
 */
export function PosSaleStartGate({
  onPick,
  tableCount,
  roomCount,
  openTicketCount,
  onOpenTickets,
  lastKind = null,
  onOpenHelp,
}: Props) {
  return (
    <div className="erp mx-auto flex w-full max-w-3xl flex-col gap-5 py-4 md:py-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5 text-center md:text-left">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
            New ticket
          </p>
          <h2 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
            How is this sale starting?
          </h2>
          <p className="max-w-lg text-sm text-muted-foreground">
            Pick once — change anytime from the context bar. Menu follows the
            floor; unlock if you need a mix.
          </p>
        </div>
        {onOpenHelp ? (
          <button
            type="button"
            onClick={onOpenHelp}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-card px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <KeyboardIcon className="size-3.5" />
            Tips · ?
          </button>
        ) : null}
      </div>

      {lastKind ? (
        <button
          type="button"
          onClick={() => onPick(lastKind)}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-left transition-colors hover:bg-accent/10"
        >
          <span>
            <span className="block text-sm font-semibold text-foreground">
              Continue as{" "}
              {lastKind === "table"
                ? "Table"
                : lastKind === "room"
                  ? "Room"
                  : "Counter"}
            </span>
            <span className="text-xs text-muted-foreground">
              Your last path — one tap
            </span>
          </span>
          <span className="text-[11px] font-semibold tracking-wide text-accent uppercase">
            Go
          </span>
        </button>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <GateCard
          icon={<UtensilsCrossedIcon className="size-6" />}
          title="Table"
          blurb="Floor first, then menu for that floor."
          meta={tableCount > 0 ? `${tableCount} tables` : "No tables set"}
          kbd="T"
          onClick={() => onPick("table")}
          accent="table"
        />
        <GateCard
          icon={<DoorOpenIcon className="size-6" />}
          title="Room"
          blurb="In-house guest — bill posts to folio."
          meta={
            roomCount > 0
              ? `${roomCount} in-house`
              : "No checked-in guests"
          }
          kbd="R"
          onClick={() => onPick("room")}
          accent="room"
          disabled={roomCount === 0}
        />
        <GateCard
          icon={<ShoppingBagIcon className="size-6" />}
          title="Counter"
          blurb="Walk-in / takeaway — pay at the till."
          meta="Fastest · any menu"
          kbd="C"
          onClick={() => onPick("counter")}
          accent="counter"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        {openTicketCount > 0 && onOpenTickets ? (
          <button
            type="button"
            onClick={onOpenTickets}
            className="inline-flex items-center gap-1.5 font-medium text-accent underline-offset-4 hover:underline"
          >
            <ListOrderedIcon className="size-3.5" />
            {openTicketCount} open ticket{openTicketCount === 1 ? "" : "s"}
          </button>
        ) : (
          <span />
        )}
        <span className="text-xs">
          Keys on this screen:{" "}
          <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">
            T
          </kbd>{" "}
          <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">
            R
          </kbd>{" "}
          <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">
            C
          </kbd>
        </span>
      </div>
    </div>
  );
}

function GateCard({
  icon,
  title,
  blurb,
  meta,
  kbd,
  onClick,
  accent,
  disabled,
}: {
  icon: ReactNode;
  title: string;
  blurb: string;
  meta: string;
  kbd: string;
  onClick: () => void;
  accent: "table" | "room" | "counter";
  disabled?: boolean;
}) {
  const ring =
    accent === "table"
      ? "hover:border-accent/50 hover:bg-accent/5"
      : accent === "room"
        ? "hover:border-sky-500/40 hover:bg-sky-500/5"
        : "hover:border-emerald-600/40 hover:bg-emerald-500/5";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "group relative flex min-h-[9.5rem] flex-col items-start gap-3 rounded-xl border bg-card p-4 text-left shadow-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        disabled
          ? "cursor-not-allowed opacity-50"
          : `cursor-pointer ${ring} active:scale-[0.99]`,
      ].join(" ")}
    >
      <span className="absolute top-3 right-3 rounded border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
        {kbd}
      </span>
      <span className="inline-flex size-11 items-center justify-center rounded-lg border bg-muted/50 text-foreground transition-colors group-hover:border-transparent group-hover:bg-background">
        {icon}
      </span>
      <span className="space-y-1">
        <span className="block text-base font-semibold text-foreground">
          {title}
        </span>
        <span className="block text-sm leading-snug text-muted-foreground">
          {blurb}
        </span>
      </span>
      <span className="mt-auto text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {meta}
      </span>
    </button>
  );
}
