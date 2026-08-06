"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import {
  BadgeCheckIcon,
  ClockIcon,
  MapPinIcon,
  SparklesIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type Reason = {
  id: string;
  short: string;
  title: string;
  body: string;
  href: string;
  linkLabel: string;
  icon: LucideIcon;
  /** Active rail / panel wash */
  accent: string;
  iconTone: string;
};

const REASONS: Reason[] = [
  {
    id: "rates",
    short: "Rates",
    title: "Direct rates, no middle layer",
    body: "Book on this site and you get the desk rate with instant confirmation — no channel markup.",
    href: "/book",
    linkLabel: "Check availability",
    icon: BadgeCheckIcon,
    accent: "bg-sky-600",
    iconTone: "from-sky-600 to-sky-500",
  },
  {
    id: "location",
    short: "Place",
    title: "Olakha, close to everything",
    body: "Minutes from the expressway, offices and the city core, with parking and calm evenings.",
    href: "/contact",
    linkLabel: "Find us",
    icon: MapPinIcon,
    accent: "bg-mint-600",
    iconTone: "from-mint-500 to-mint-600",
  },
  {
    id: "services",
    short: "In-house",
    title: "One roof, five services",
    body: "Rooms, cafe, restaurant, bar and spa share a desk — one bill, one team, one place.",
    href: "/services",
    linkLabel: "See services",
    icon: SparklesIcon,
    accent: "bg-citrus",
    iconTone: "from-citrus-soft to-citrus",
  },
  {
    id: "live",
    short: "Live",
    title: "Live availability",
    body: "What you see is what the desk sees — rooms, kitchen tickets and housekeeping in real time.",
    href: "/book",
    linkLabel: "Open calendar",
    icon: ClockIcon,
    accent: "bg-sky-500",
    iconTone: "from-sky-500 to-mint-500",
  },
];

/** Phone: expand-one accordion. Desktop: tab list + feature panel. */
export function HomeWhyReasons() {
  const [activeId, setActiveId] = useState(REASONS[0].id);
  const active = REASONS.find((r) => r.id === activeId) ?? REASONS[0];
  const ActiveIcon = active.icon;
  const activeIndex = REASONS.findIndex((r) => r.id === activeId);

  return (
    <>
      {/* ——— Mobile accordion ——— */}
      <div className="md:hidden">
        <Accordion
          type="single"
          collapsible
          defaultValue={REASONS[0].id}
          className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_16px_48px_-28px_rgba(8,47,73,0.35)]"
        >
          {REASONS.map((reason, index) => {
            const Icon = reason.icon;
            return (
              <AccordionItem
                key={reason.id}
                value={reason.id}
                className="border-border/70 px-0"
              >
                <AccordionTrigger
                  className={cn(
                    "items-center gap-3 px-4 py-3.5 min-h-14 hover:no-underline",
                    "data-[state=open]:bg-sky-ink/[0.03]",
                  )}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-3">
                    <span
                      className={cn(
                        "inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm",
                        reason.iconTone,
                      )}
                    >
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0 text-left">
                      <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="mt-0.5 block text-[15px] font-semibold leading-snug text-foreground">
                        {reason.title}
                      </span>
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-5 pt-0">
                  <div className="ml-[3.25rem] border-l-2 border-border/80 pl-4">
                    <p className="text-sm leading-6 text-muted-foreground">
                      {reason.body}
                    </p>
                    <Link
                      href={reason.href}
                      className="mt-3 inline-flex text-sm font-semibold text-sky-700 underline-offset-4 hover:underline"
                    >
                      {reason.linkLabel} →
                    </Link>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>

      {/* ——— Desktop: vertical tabs + spotlight panel ——— */}
      <div className="mt-10 hidden overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-[0_24px_64px_-40px_rgba(8,47,73,0.35)] md:grid md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <div
          className="flex flex-col border-b border-border/70 bg-frost-2/40 md:border-b-0 md:border-r"
          role="tablist"
          aria-label="Why stay at Pelbu"
        >
          {REASONS.map((reason, index) => {
            const Icon = reason.icon;
            const selected = reason.id === activeId;
            return (
              <button
                key={reason.id}
                type="button"
                role="tab"
                id={`why-tab-${reason.id}`}
                aria-selected={selected}
                aria-controls={`why-panel-${reason.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveId(reason.id)}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowDown" && event.key !== "ArrowUp")
                    return;
                  event.preventDefault();
                  const delta = event.key === "ArrowDown" ? 1 : -1;
                  const next =
                    REASONS[
                      (index + delta + REASONS.length) % REASONS.length
                    ];
                  setActiveId(next.id);
                  document.getElementById(`why-tab-${next.id}`)?.focus();
                }}
                className={cn(
                  "group relative flex items-start gap-3 border-b border-border/60 px-5 py-5 text-left transition-colors last:border-b-0",
                  selected
                    ? "bg-background"
                    : "hover:bg-background/70",
                )}
              >
                <span
                  className={cn(
                    "absolute inset-y-3 left-0 w-1 rounded-r-full transition-opacity",
                    reason.accent,
                    selected ? "opacity-100" : "opacity-0 group-hover:opacity-40",
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    "mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white",
                    reason.iconTone,
                    !selected && "opacity-80",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {String(index + 1).padStart(2, "0")} · {reason.short}
                  </span>
                  <span
                    className={cn(
                      "mt-1 block text-sm font-semibold leading-snug",
                      selected ? "text-foreground" : "text-foreground/80",
                    )}
                  >
                    {reason.title}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div
          id={`why-panel-${active.id}`}
          role="tabpanel"
          aria-labelledby={`why-tab-${active.id}`}
          className="relative flex min-h-[20rem] flex-col justify-center overflow-hidden px-8 py-10 lg:px-12 lg:py-12"
        >
          <span
            className="pointer-events-none absolute -right-4 -top-6 select-none font-display text-[9rem] leading-none text-sky-ink/[0.05]"
            aria-hidden
          >
            {String(activeIndex + 1).padStart(2, "0")}
          </span>
          <div
            className={cn(
              "pointer-events-none absolute -bottom-16 -right-10 size-64 rounded-full opacity-30 blur-[80px]",
              active.accent,
            )}
            aria-hidden
          />
          <div className="relative">
            <span
              className={cn(
                "inline-flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg",
                active.iconTone,
              )}
            >
              <ActiveIcon className="size-7" aria-hidden />
            </span>
            <p className="mt-6 font-mono text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              {active.short}
            </p>
            <h3 className="mt-2 max-w-md font-display text-3xl leading-tight text-foreground lg:text-[2.15rem]">
              {active.title}
            </h3>
            <p className="mt-4 max-w-lg text-[15px] leading-7 text-muted-foreground">
              {active.body}
            </p>
            <Link
              href={active.href}
              className="mt-6 inline-flex h-11 items-center rounded-xl bg-sky-ink px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              {active.linkLabel} →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
